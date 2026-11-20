import { NextResponse } from 'next/server';
import { permisosResueltos, type Permiso } from '@/lib/permisos';
import { postergacionesResueltas, type Postergacion } from '@/lib/postergaciones';
import { correoDe, nombreArchivo } from '@/lib/pdf/generar';
import { fichaDe } from '@/lib/datos';
import { nombreTipo } from '@/lib/reglasPermisos';
import { TEXTO_ESTADO } from '@/lib/postergaciones';
import {
  CARPETAS,
  TIPO_EXCEL,
  anioDe,
  baseDe,
  carpetaDe,
  cargosPorMes,
  esIntegracion,
  escribirCursor,
  leerCursor,
  nombreMes,
  rangoDe,
} from '@/lib/integracion';
import { auditar } from '@/lib/db';

/**
 * Lo que los flujos de Power Automate leen para archivar el PDF, alimentar las bases de Excel y
 * avisarle por correo al funcionario con copia a su jefatura y a la administración.
 *
 * Se consulta con el token del servicio:
 *
 *   GET /api/integracion/documentos?tipo=permiso&desde=2026-11-20T13:00:00.000Z|41
 *   Authorization: Bearer <TOKEN_INTEGRACION>
 *
 * Cada flujo guarda el cursor que le corresponde de la respuesta (cursor.permiso o
 * cursor.postergacion) y lo manda como "desde" en la corrida siguiente, así no repite ni se salta
 * documentos. Son cursores separados porque los permisos y las postergaciones viven en tablas
 * distintas y cada una avanza por su cuenta.
 *
 * Un documento aparece recién cuando su proceso está cerrado: el permiso autorizado o rechazado, y
 * la postergación aceptada, desistida o resuelta sin postergación.
 */

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

/** Datos de contacto de una persona, para que el flujo sepa a quién escribirle. */
async function contacto(rut: string | null, nombre: string | null) {
  if (!rut) return null;
  return { rut, nombre, correo: await correoDe(rut) };
}

async function documentoDePermiso(p: Permiso, origen: string) {
  const { desde, hasta } = rangoDe(p.dias);
  const anio = anioDe(p.dias, new Date(p.creadaEn).getFullYear());
  const clave = carpetaDe(p.tipo);
  const base = baseDe(p.tipo);
  const tipoExcel = TIPO_EXCEL[p.tipo];
  const autorizado = p.estado === 'autorizado';
  const cargos = autorizado ? cargosPorMes(p.dias) : [];
  const ficha = await fichaDe(p.rut);
  const programa = ficha.dias?.programa ?? '';
  const horas = p.totalMinutos > 0 ? Math.round((p.totalMinutos / 60) * 100) / 100 : 0;

  const [funcionario, jefatura] = await Promise.all([
    contacto(p.rut, p.ficha.nombre),
    contacto(p.jefaturaRut, p.ficha.jefaturaNombre),
  ]);

  return {
    id: p.id,
    codigo: p.codigo,
    clase: 'permiso' as const,
    tipo: p.tipo,
    tipoNombre: nombreTipo(p.tipo),
    tipoExcel,
    causal: p.causal,
    estado: p.estado,
    autorizado,
    resueltoEn: new Date(p.actualizadaEn).toISOString(),
    pdf: {
      ruta: `/api/documentos/${p.codigo}`,
      url: `${origen}/api/documentos/${p.codigo}`,
      archivo: nombreArchivo(p.ficha.nombre, p.codigo),
    },
    archivo: {
      anio,
      carpeta: CARPETAS[clave],
      carpetaClave: clave,
      ruta: `${anio}/${CARPETAS[clave]}`,
    },
    funcionario: {
      ...funcionario,
      programa,
      unidad: p.ficha.unidad,
      cargo: p.ficha.cargo,
      estamento: p.ficha.estamento,
      grado: p.ficha.grado,
    },
    jefatura,
    permiso: {
      desde,
      hasta,
      totalDias: p.totalDias,
      horaDesde: p.horaDesde,
      horaHasta: p.horaHasta,
      totalMinutos: p.totalMinutos,
      totalHoras: horas,
      detalle: p.detalle,
      certificado: p.certificado,
      dias: p.dias,
    },
    base,
    /** Una fila por mes al que se carga el permiso, tal como va en la hoja Movimientos. */
    movimientos:
      base === 'ninguna' || !tipoExcel
        ? []
        : cargos.map((c) => ({
            rutDv: p.ficha.rutTexto,
            nombre: p.ficha.nombre,
            tipo: tipoExcel,
            mes: c.mes,
            mesNombre: c.mesNombre,
            anio: c.anio,
            dias: base === 'descansos' ? null : c.dias,
            horas: base === 'descansos' ? horas : null,
            fechaInicio: desde,
            fechaTermino: hasta,
            fecha: desde,
            horaInicio: p.horaDesde,
            horaFin: p.horaHasta,
            codigo: p.codigo,
            origen: 'Plataforma',
            documento: p.codigo,
          })),
    /** La fila del registro histórico, con los mismos nombres de columna de la hoja de detalle. */
    detalleUso:
      base === 'dias' && tipoExcel
        ? {
            'RUT-DV': p.ficha.rutTexto,
            PROGRAMA: programa,
            'NOMBRE COMPLETO': p.ficha.nombre,
            'ÁREA/SUBDIRECCIÓN': p.ficha.unidad,
            Tipo: tipoExcel,
            'N° Dias': p.totalDias,
            'Fecha inicio': desde,
            'Fecha termino': hasta,
            Comentarios: p.detalle,
          }
        : base === 'descansos' && tipoExcel
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
            }
          : null,
    /** El interferiado va a su propia base: la cabecera y un día por cada devolución comprometida. */
    interferiado:
      p.tipo === 'interferiado' && autorizado
        ? {
            cabecera: {
              rutDv: p.ficha.rutTexto,
              nombre: p.ficha.nombre,
              programa,
              unidad: p.ficha.unidad,
              fecha: desde,
              horasADevolver: p.recuperacion?.horas ?? 0,
              diasDeDevolucion: p.recuperacion?.dias.length ?? 0,
              primeraDevolucion: p.recuperacion?.dias[0]?.fecha ?? null,
              ultimaDevolucion: p.recuperacion?.dias.at(-1)?.fecha ?? null,
              codigo: p.codigo,
              documento: p.codigo,
              origen: 'Plataforma',
            },
            devoluciones: (p.recuperacion?.dias ?? []).map((d) => ({
              rutDv: p.ficha.rutTexto,
              nombre: p.ficha.nombre,
              fecha: d.fecha,
              horasComprometidas: d.horas,
              fechaInterferiado: desde,
              codigo: p.codigo,
            })),
          }
        : null,
  };
}

async function documentoDePostergacion(p: Postergacion, origen: string) {
  const [funcionario, jefatura] = await Promise.all([
    contacto(p.rut, p.ficha.nombre),
    contacto(p.jefaturaRut, p.ficha.jefaturaNombre),
  ]);
  // Los días postergados se toman al año siguiente, y ahí se archiva el documento.
  const anio = p.anio + 1;
  return {
    id: p.id,
    codigo: p.codigo,
    clase: 'postergacion' as const,
    tipo: 'postergacion' as const,
    tipoNombre: 'Postergación de feriado legal',
    estado: p.estado,
    estadoTexto: TEXTO_ESTADO[p.estado],
    autorizado: p.estado === 'completa',
    resueltoEn: new Date(p.actualizadaEn).toISOString(),
    pdf: {
      ruta: `/api/documentos/${p.codigo}`,
      url: `${origen}/api/documentos/${p.codigo}`,
      archivo: nombreArchivo(p.ficha.nombre, p.codigo),
    },
    archivo: {
      anio,
      carpeta: CARPETAS.postergacion,
      carpetaClave: 'postergacion' as const,
      ruta: `${anio}/${CARPETAS.postergacion}`,
    },
    funcionario: { ...funcionario, unidad: p.ficha.unidad, cargo: p.ficha.cargo },
    jefatura,
    postergacion: {
      anio: p.anio,
      anioDeUso: anio,
      diasSolicitados: p.diasSolicitados,
      fechaInicio: p.fechaInicio,
      diasAcumular: p.diasAcumular,
      mesNombre: p.fechaInicio ? nombreMes(Number(p.fechaInicio.slice(5, 7))) : null,
    },
    base: 'ninguna' as const,
    movimientos: [],
    detalleUso: null,
    interferiado: null,
  };
}

export async function GET(req: Request) {
  if (!esIntegracion(req)) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }
  const url = new URL(req.url);
  const tipo = url.searchParams.get('tipo');
  if (tipo && tipo !== 'permiso' && tipo !== 'postergacion') {
    return NextResponse.json({ error: 'El parámetro tipo tiene que ser permiso o postergacion.' }, { status: 400 });
  }
  const desdeCrudo = url.searchParams.get('desde');
  const desde = leerCursor(desdeCrudo);
  if (desdeCrudo && !desde) {
    return NextResponse.json({ error: 'El parámetro desde no es un cursor válido.' }, { status: 400 });
  }
  const pedido = Number(url.searchParams.get('limite'));
  const limite = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO;
  const origen = url.origin;

  const [permisos, postergaciones] = await Promise.all([
    tipo === 'postergacion' ? Promise.resolve([]) : permisosResueltos(desde, limite),
    tipo === 'permiso' ? Promise.resolve([]) : postergacionesResueltas(desde, limite),
  ]);

  const documentos = (
    await Promise.all([
      ...permisos.map((p) => documentoDePermiso(p, origen)),
      ...postergaciones.map((p) => documentoDePostergacion(p, origen)),
    ])
  ).sort((a, b) => a.resueltoEn.localeCompare(b.resueltoEn) || a.id - b.id);

  // Un cursor por tabla: cada flujo avanza el suyo. Si en esta tanda no vino nada de una tabla, se
  // devuelve el cursor que traía el flujo, para no saltarse lo que llegue justo después.
  const ultimo = <T extends { id: number; actualizadaEn: Date }>(lista: T[]) => {
    const x = lista.at(-1);
    return x ? escribirCursor({ en: new Date(x.actualizadaEn).toISOString(), id: x.id }) : desdeCrudo;
  };

  await auditar('integracion', 'integracion.documentos', {
    tipo: tipo ?? 'todos',
    desde: desdeCrudo,
    entregados: documentos.length,
  });

  return NextResponse.json(
    {
      documentos,
      cursor: { permiso: ultimo(permisos), postergacion: ultimo(postergaciones) },
      hayMas: permisos.length >= limite || postergaciones.length >= limite,
      copiaA: ['administracion.personas@slepaconcagua.gob.cl'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
