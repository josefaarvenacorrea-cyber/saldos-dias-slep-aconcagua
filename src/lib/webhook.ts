import 'server-only';
import { auditar } from './db.ts';
import { correoDe, nombreArchivo, pdfDePermiso, pdfDePostergacion } from './pdf/generar.ts';
import { permisoPorId, type Permiso } from './permisos.ts';
import { porId, TEXTO_ESTADO, type Postergacion } from './postergaciones.ts';
import { fichaDe } from './datos.ts';
import { CARPETAS, TIPO_EXCEL, anioDe, baseDe, carpetaDe, cargosPorMes, rangoDe } from './integracion.ts';
import {
  asuntoPermiso,
  asuntoPostergacion,
  correoPermisoPendiente,
  correoPlano,
  correoPostergacionPendiente,
  correoPostergacionPropuesta,
  cuerpoPermiso,
  cuerpoPostergacion,
  codigoDetalle,
  fechaTexto,
  filaMovimiento,
  textoDeUso,
  tipoTexto,
} from './avisos.ts';

/**
 * Le avisa al flujo de Power Automate que se emitió un documento, con todo lo que necesita para
 * archivar el PDF en el SharePoint, escribir las filas en las bases y mandar el correo.
 *
 * La plataforma empuja y el flujo recibe, no al revés. Así el flujo solo necesita el disparador
 * "Cuando se recibe una solicitud HTTP" y conectores estándar: la acción HTTP, que es premium, no
 * hace falta en ninguna parte.
 *
 * Si POWER_AUTOMATE_WEBHOOK_URL no está definida, esto no hace nada y el resto de la plataforma
 * sigue funcionando igual. El endpoint /api/integracion/documentos queda como respaldo para
 * recuperar lo que no se haya alcanzado a avisar.
 */

const TIEMPO_MAXIMO = 15000;

/** La dirección pública de la plataforma, para los enlaces de los correos. */
function baseUrl(): string {
  const propia = process.env.URL_PLATAFORMA;
  if (propia) return propia.replace(/\/$/, '');
  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (produccion) return `https://${produccion}`;
  return 'https://saldos-dias-slep-aconcagua.vercel.app';
}

async function postear(cuerpo: unknown, codigo: string): Promise<boolean> {
  const url = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!url) return false;
  try {
    const corte = AbortSignal.timeout(TIEMPO_MAXIMO);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: corte,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('Power Automate respondió con error', res.status, detalle.slice(0, 300));
      await auditar('plataforma', 'aviso.error', { codigo, estado: res.status });
      return false;
    }
    await auditar('plataforma', 'aviso.enviado', { codigo });
    return true;
  } catch (e) {
    // Un aviso que falla no debe romper la firma: el documento ya quedó emitido.
    console.error('No se pudo avisar al flujo de Power Automate', e);
    await auditar('plataforma', 'aviso.error', { codigo, motivo: e instanceof Error ? e.message : String(e) }).catch(
      () => {},
    );
    return false;
  }
}

/** El aviso de un permiso ya respondido por la jefatura. */
export async function avisarPermiso(id: number): Promise<boolean> {
  const p = await permisoPorId(id);
  if (!p || p.estado === 'pendiente_jefatura') return false;
  return postear(await cuerpoDePermiso(p), p.codigo);
}

/**
 * El aviso a la jefatura de que tiene un permiso esperando su firma. Va sin PDF y con el enlace
 * para entrar a firmar: el formulario todavía no está firmado por las dos partes.
 */
export async function avisarPermisoPendiente(id: number): Promise<boolean> {
  const p = await permisoPorId(id);
  if (!p || p.estado !== 'pendiente_jefatura') return false;
  const jefaturaCorreo = await correoDe(p.jefaturaRut);
  const { desde, hasta } = rangoDe(p.dias);
  const { asunto, cuerpoHtml } = correoPermisoPendiente({
    codigo: p.codigo,
    destinatarioNombre: p.ficha.jefaturaNombre,
    solicitanteNombre: p.ficha.nombre,
    jefaturaNombre: p.ficha.jefaturaNombre,
    enlace: `${baseUrl()}/autorizaciones`,
    tipo: p.tipo,
    desde,
    hasta,
    totalDias: p.totalDias,
    horaDesde: p.horaDesde,
    horaHasta: p.horaHasta,
    detalle: p.detalle,
  });
  return postear(
    {
      version: 1,
      evento: 'permiso.solicitado',
      clase: 'permiso',
      codigo: p.codigo,
      tipo: p.tipo,
      tipoNombre: tipoTexto(p.tipo),
      estado: p.estado,
      archivar: false,
      // Solo la jefatura: el funcionario ya sabe que lo pidió, y administración lo verá al cerrarse.
      correo: jefaturaCorreo
        ? { para: jefaturaCorreo, copia: '', asunto, cuerpoHtml, adjuntoNombre: '', adjuntoContenidoBase64: '' }
        : null,
      archivo: null,
      base: 'ninguna',
      movimientos: [],
      detalleUso: null,
      interferiado: null,
    },
    p.codigo,
  );
}

/** El aviso a la jefatura de que tiene una postergación esperando su firma de la sección II. */
export async function avisarPostergacionPendiente(id: number): Promise<boolean> {
  const p = await porId(id);
  if (!p || p.estado !== 'pendiente_jefatura') return false;
  const jefaturaCorreo = await correoDe(p.jefaturaRut);
  const { asunto, cuerpoHtml } = correoPostergacionPendiente({
    codigo: p.codigo,
    destinatarioNombre: p.ficha.jefaturaNombre,
    solicitanteNombre: p.ficha.nombre,
    jefaturaNombre: p.ficha.jefaturaNombre,
    enlace: `${baseUrl()}/autorizaciones`,
    diasSolicitados: p.diasSolicitados,
    fechaInicio: p.fechaInicio,
  });
  return postear(sobreSinArchivo(p, 'postergacion.solicitada', jefaturaCorreo, '', asunto, cuerpoHtml), p.codigo);
}

/** El aviso al funcionario de que la jefatura propuso postergar y falta su firma de la sección III. */
export async function avisarPostergacionPropuesta(id: number): Promise<boolean> {
  const p = await porId(id);
  if (!p || p.estado !== 'pendiente_funcionario') return false;
  const correo = await correoDe(p.rut);
  const { asunto, cuerpoHtml } = correoPostergacionPropuesta({
    codigo: p.codigo,
    destinatarioNombre: p.ficha.nombre,
    solicitanteNombre: p.ficha.nombre,
    jefaturaNombre: p.ficha.jefaturaNombre,
    enlace: `${baseUrl()}/mis-dias/postergacion`,
    diasSolicitados: p.diasSolicitados,
    fechaInicio: p.fechaInicio,
    postergable: p.ficha.postergableAlSolicitar ?? null,
  });
  return postear(sobreSinArchivo(p, 'postergacion.propuesta', correo, '', asunto, cuerpoHtml), p.codigo);
}

/** El sobre de un aviso intermedio: sin PDF, sin archivo y sin filas que escribir. */
function sobreSinArchivo(
  p: Postergacion,
  evento: string,
  para: string | null,
  copia: string,
  asunto: string,
  cuerpoHtml: string,
) {
  return {
    version: 1,
    evento,
    clase: 'postergacion',
    codigo: p.codigo,
    tipo: 'postergacion',
    tipoNombre: 'Postergación de feriado legal',
    estado: p.estado,
    archivar: false,
    correo: para ? { para, copia, asunto, cuerpoHtml, adjuntoNombre: '', adjuntoContenidoBase64: '' } : null,
    archivo: null,
    base: 'ninguna',
    movimientos: [],
    detalleUso: null,
    interferiado: null,
  };
}

async function cuerpoDePermiso(p: Permiso) {
  const [pdf, correo, jefaturaCorreo, ficha] = await Promise.all([
    pdfDePermiso(p),
    correoDe(p.rut),
    correoDe(p.jefaturaRut),
    fichaDe(p.rut),
  ]);
  const base64 = pdf.toString('base64');
  const archivo = nombreArchivo(p.ficha.nombre, p.codigo);
  const { desde, hasta } = rangoDe(p.dias);
  const anio = anioDe(p.dias, new Date(p.creadaEn).getFullYear());
  const clave = carpetaDe(p.tipo);
  const base = baseDe(p.tipo);
  const tipoExcel = TIPO_EXCEL[p.tipo];
  const autorizado = p.estado === 'autorizado';
  const horas = p.totalMinutos > 0 ? Math.round((p.totalMinutos / 60) * 100) / 100 : 0;
  const programa = ficha.dias?.programa ?? '';
  const recuperacion =
    p.tipo === 'interferiado' && p.recuperacion
      ? {
          horas: p.recuperacion.horas,
          dias: p.recuperacion.dias.length,
          desde: p.recuperacion.dias[0]?.fecha ?? null,
          hasta: p.recuperacion.dias.at(-1)?.fecha ?? null,
        }
      : null;

  const datos = {
    codigo: p.codigo,
    tipo: p.tipo,
    nombre: p.ficha.nombre,
    jefaturaNombre: p.ficha.jefaturaNombre,
    autorizado,
    desde,
    hasta,
    totalDias: p.totalDias,
    horaDesde: p.horaDesde,
    horaHasta: p.horaHasta,
    recuperacion,
  };

  const comun = {
    rutDv: p.ficha.rutTexto,
    nombre: p.ficha.nombre,
    tipo: tipoExcel ?? tipoTexto(p.tipo),
    desde,
    hasta,
    codigo: p.codigo,
  };

  return {
    version: 1,
    evento: 'permiso.respondido',
    clase: 'permiso',
    archivar: true,
    codigo: p.codigo,
    tipo: p.tipo,
    tipoNombre: tipoTexto(p.tipo),
    estado: p.estado,
    autorizado,
    // El PDF va repetido en el correo y en el archivo a propósito: así los dos pasos del flujo
    // arrastran su propio campo y nadie tiene que escribir una expresión para alcanzarlo.
    correo: correoPlano(correo, jefaturaCorreo, asuntoPermiso(datos), cuerpoPermiso(datos), archivo, base64),
    archivo: { carpeta: CARPETAS[clave], anio, ruta: `${anio}/${CARPETAS[clave]}`, nombre: archivo, contenidoBase64: base64 },
    base,
    movimientos:
      !autorizado || base === 'ninguna' || !tipoExcel
        ? []
        : cargosPorMes(p.dias).map((c) => filaMovimiento(c, comun, base === 'descansos' ? horas : null)),
    detalleUso:
      !autorizado || !tipoExcel
        ? null
        : base === 'dias'
          ? {
              'RUT-DV': p.ficha.rutTexto,
              PROGRAMA: programa,
              'NOMBRE COMPLETO': p.ficha.nombre,
              'ÁREA/SUBDIRECCIÓN': p.ficha.unidad,
              Tipo: tipoExcel,
              'N° Dias': p.totalDias,
              'Fecha inicio': desde,
              'Fecha termino': hasta,
              Código: codigoDetalle(p.ficha.rutTexto, desde),
              Comentarios: p.detalle,
              'Texto Fecha inicio': fechaTexto(desde),
              'Texto Fecha Término': fechaTexto(hasta),
              'Texto de uso': textoDeUso(tipoExcel, p.totalDias, desde),
            }
          : base === 'descansos'
            ? {
                'RUT-DV': p.ficha.rutTexto,
                PROGRAMA: programa,
                'NOMBRE COMPLETO': p.ficha.nombre,
                'ÁREA/SUBDIRECCIÓN': p.ficha.unidad,
                Tipo: tipoExcel,
                'N° Horas': horas,
                'Hora Inicio': p.horaDesde,
                'Hora Fin': p.horaHasta,
                'Fecha inicio': desde,
                'Fecha termino': hasta,
                Código: codigoDetalle(p.ficha.rutTexto, desde),
              }
            : null,
    interferiado:
      p.tipo === 'interferiado' && autorizado
        ? {
            cabecera: {
              'RUT-DV': p.ficha.rutTexto,
              'NOMBRE COMPLETO': p.ficha.nombre,
              PROGRAMA: programa,
              'ÁREA/SUBDIRECCIÓN': p.ficha.unidad,
              'Fecha del interferiado': desde,
              'Horas a devolver': recuperacion?.horas ?? 0,
              'Días de devolución': recuperacion?.dias ?? 0,
              'Primera devolución': recuperacion?.desde ?? null,
              'Última devolución': recuperacion?.hasta ?? null,
              Código: p.codigo,
              'N° documento': p.codigo,
              Origen: 'Plataforma',
            },
            devoluciones: (p.recuperacion?.dias ?? []).map((d) => ({
              'RUT-DV': p.ficha.rutTexto,
              'NOMBRE COMPLETO': p.ficha.nombre,
              'Fecha de devolución': d.fecha,
              'Horas extra comprometidas': d.horas,
              'Fecha del interferiado': desde,
              Código: p.codigo,
            })),
          }
        : null,
  };
}

/** El aviso de una postergación con el proceso ya cerrado. */
export async function avisarPostergacion(id: number): Promise<boolean> {
  const p = await porId(id);
  if (!p || p.estado === 'pendiente_jefatura' || p.estado === 'pendiente_funcionario') return false;
  return postear(await cuerpoDePostergacion(p), p.codigo);
}

async function cuerpoDePostergacion(p: Postergacion) {
  const [pdf, correo, jefaturaCorreo] = await Promise.all([
    pdfDePostergacion(p),
    correoDe(p.rut),
    correoDe(p.jefaturaRut),
  ]);
  const base64 = pdf.toString('base64');
  const archivo = nombreArchivo(p.ficha.nombre, p.codigo);
  // Los días postergados se toman al año siguiente, y ahí se archiva el documento.
  const anio = p.anio + 1;
  const datos = {
    codigo: p.codigo,
    nombre: p.ficha.nombre,
    jefaturaNombre: p.ficha.jefaturaNombre,
    estadoTexto: TEXTO_ESTADO[p.estado],
    acepto: p.estado === 'completa',
    anio: p.anio,
    anioDeUso: anio,
    diasAcumular: p.diasAcumular,
    fechaInicio: p.fechaInicio,
  };
  return {
    version: 1,
    evento: 'postergacion.cerrada',
    clase: 'postergacion',
    archivar: true,
    codigo: p.codigo,
    tipo: 'postergacion',
    tipoNombre: 'Postergación de feriado legal',
    estado: p.estado,
    estadoTexto: TEXTO_ESTADO[p.estado],
    autorizado: p.estado === 'completa',
    correo: correoPlano(
      correo,
      jefaturaCorreo,
      asuntoPostergacion(datos),
      cuerpoPostergacion(datos),
      archivo,
      base64,
    ),
    archivo: {
      carpeta: CARPETAS.postergacion,
      anio,
      ruta: `${anio}/${CARPETAS.postergacion}`,
      nombre: archivo,
      contenidoBase64: base64,
    },
    base: 'ninguna',
    movimientos: [],
    detalleUso: null,
    interferiado: null,
    postergacion: {
      'RUT-DV': p.ficha.rutTexto,
      'NOMBRE COMPLETO': p.ficha.nombre,
      Año: p.anio,
      'Año de uso': anio,
      'Días solicitados': p.diasSolicitados,
      'Fecha inicio': p.fechaInicio,
      'Días a acumular': p.diasAcumular,
      Estado: TEXTO_ESTADO[p.estado],
      Código: p.codigo,
    },
  };
}
