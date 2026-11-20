import type { Alerta, FichaDotacion, ResultadoLectura } from '../tipos.ts';
import { limpiarRut, numeroRut, rutValido, dvDe } from '../rut.ts';
import { abrirLibro, columnaOpcional, ErrorFormato, fecha, filaDeEncabezados, mapaDeColumnas, texto, valor } from './comun.ts';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function correo(v: unknown): string | null {
  const s = texto(v).toLowerCase();
  return CORREO.test(s) ? s : null;
}

/**
 * Si el RUT-DV escrito no es válido, prueba con las columnas RUT y DV de la misma fila
 * (y con la columna RUT cuando trae el dígito pegado al final). Devuelve el primero válido.
 */
function rutValidoDeLaFila(escrito: string, columnaRut: string, columnaDv: string): string | null {
  if (rutValido(escrito)) return null;
  const numero = columnaRut.replace(/\D/g, '');
  const dv = columnaDv.trim().toUpperCase();
  const candidatos = [numero && dv ? `${numero}-${dv}` : '', numero.length >= 8 ? `${numero.slice(0, -1)}-${numero.slice(-1)}` : ''];
  return candidatos.find((x) => x && rutValido(x)) ?? null;
}

/**
 * Lee la Dotación efectiva. Solo se guardan los datos laborales que se muestran en la plataforma
 * y los correos para ingresar; se ignoran columnas como sexo u origen.
 */
export async function leerDotacion(buffer: ArrayBuffer | Uint8Array): Promise<ResultadoLectura<FichaDotacion>> {
  const libro = await abrirLibro(buffer);
  let hoja = null;
  let fEnc: number | null = null;
  for (const h of libro.worksheets) {
    const f = filaDeEncabezados(h, ['RUT-DV', 'NOMBRE COMPLETO']) ?? filaDeEncabezados(h, ['RUT', 'NOMBRE COMPLETO']);
    if (f) { hoja = h; fEnc = f; break; }
  }
  if (!hoja || !fEnc) throw new ErrorFormato('No encuentro una hoja con las columnas "RUT-DV" y "NOMBRE COMPLETO". ¿Es el archivo de Dotación?');

  const m = mapaDeColumnas(hoja, fEnc);
  const c = {
    rutDv: columnaOpcional(m, 'RUT-DV'),
    rut: columnaOpcional(m, 'RUT'),
    dv: columnaOpcional(m, 'DV'),
    nombre: columnaOpcional(m, 'NOMBRE COMPLETO')!,
    area: columnaOpcional(m, 'ÁREA/SUBDIRECCIÓN', 'AREA/SUBDIRECCION', 'AREA'),
    cargo: columnaOpcional(m, 'CARGO'),
    cargoOrg: columnaOpcional(m, 'CARGO NUEVO ORGANIGRAMA'),
    estamento: columnaOpcional(m, 'ESTAMENTO'),
    calidad: columnaOpcional(m, 'CALIDAD JURIDICA', 'CALIDAD JURÍDICA'),
    grado: columnaOpcional(m, 'GRADO'),
    ingreso: columnaOpcional(m, 'FECHA DE INGRESO SLEP', 'FECHA INGRESO SLEP', 'FECHA DE INGRESO'),
    jefatura: columnaOpcional(m, 'JEFATURA'),
    correoInst: columnaOpcional(m, 'CORREO INSTITUCIONAL', 'CORREO'),
    correoPers: columnaOpcional(m, 'CORREO PERSONAL'),
  };
  if (!c.correoInst && !c.correoPers) {
    throw new ErrorFormato('La Dotación no tiene columna de correo ("CORREO INSTITUCIONAL" o "CORREO PERSONAL"). Sin correo nadie puede ingresar.');
  }

  const alertas: Alerta[] = [];
  const alerta = (a: Omit<Alerta, 'archivo'>) => alertas.push({ archivo: 'dotacion', ...a });
  const personas: Record<string, FichaDotacion & { fila: number }> = {};
  const correos = new Map<string, string>();
  const t = (fila: ReturnType<typeof hoja.getRow>, col?: number) => (col ? texto(valor(fila.getCell(col))) : '');

  for (let r = fEnc + 1; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const escrito = t(fila, c.rutDv) || t(fila, c.rut);
    const nombre = t(fila, c.nombre);
    if (!escrito) {
      if (nombre) alerta({ nivel: 'media', hoja: hoja.name, fila: r, rut: '', nombre, alerta: 'Fila sin RUT', detalle: 'No se puede asociar a ningún saldo.' });
      continue;
    }
    const corregido = c.rutDv ? rutValidoDeLaFila(escrito, t(fila, c.rut), t(fila, c.dv)) : null;
    const rutTexto = corregido ?? escrito;
    const rut = numeroRut(rutTexto);
    if (corregido) {
      alerta({ nivel: 'media', hoja: hoja.name, fila: r, rut: escrito, nombre, alerta: 'RUT-DV mal escrito', detalle: `Dice ${limpiarRut(escrito)}, que no es un RUT válido. Se usó ${limpiarRut(corregido)}, que sale de las columnas RUT y DV de la misma fila. Corrige la columna RUT-DV.` });
    } else if (c.rutDv && !rutValido(rutTexto)) {
      alerta({ nivel: 'alta', hoja: hoja.name, fila: r, rut: rutTexto, nombre, alerta: 'RUT con dígito verificador inválido', detalle: `Para el número ${rut} el dígito correcto es ${dvDe(rut)}. Mientras no se corrija, esta persona no recibe su correo ni sus datos laborales.` });
    }
    const correoInstitucional = c.correoInst ? correo(valor(fila.getCell(c.correoInst))) : null;
    const correoPersonal = c.correoPers ? correo(valor(fila.getCell(c.correoPers))) : null;
    const ficha: FichaDotacion & { fila: number } = {
      fila: r,
      rut,
      rutTexto: limpiarRut(rutTexto),
      nombre,
      area: t(fila, c.area),
      cargo: t(fila, c.cargo),
      cargoOrganigrama: t(fila, c.cargoOrg),
      estamento: t(fila, c.estamento),
      calidadJuridica: t(fila, c.calidad),
      grado: t(fila, c.grado),
      fechaIngreso: c.ingreso ? fecha(valor(fila.getCell(c.ingreso))) : null,
      jefatura: t(fila, c.jefatura) === '-' ? '' : t(fila, c.jefatura),
      correoInstitucional,
      correoPersonal,
    };
    const previa = personas[rut];
    if (previa) {
      // Misma persona en dos filas (ej. dos contratos): se completa lo que falte en la primera.
      previa.correoInstitucional ??= correoInstitucional;
      previa.correoPersonal ??= correoPersonal;
      for (const k of ['area', 'cargo', 'cargoOrganigrama', 'estamento', 'calidadJuridica', 'grado', 'jefatura'] as const) if (!previa[k]) previa[k] = ficha[k];
      previa.fechaIngreso ??= ficha.fechaIngreso;
      alerta({ nivel: 'baja', hoja: hoja.name, fila: r, rut: rutTexto, nombre, alerta: 'RUT repetido en la Dotación', detalle: `También está en la fila ${previa.fila}. Se combinaron los datos de ambas filas.` });
    } else {
      personas[rut] = ficha;
    }
    for (const e of [correoInstitucional, correoPersonal]) {
      if (!e) continue;
      const otro = correos.get(e);
      if (otro && otro !== rut) alerta({ nivel: 'alta', hoja: hoja.name, fila: r, rut: rutTexto, nombre, alerta: 'Correo repetido en dos personas', detalle: `El correo ${e} también está asignado a otro RUT. Ninguna de las dos personas podrá usarlo hasta corregirlo.` });
      else correos.set(e, rut);
    }
  }
  const salida: Record<string, FichaDotacion> = {};
  let conCorreo = 0;
  for (const [rut, { fila: _f, ...ficha }] of Object.entries(personas)) {
    salida[rut] = ficha;
    if (ficha.correoInstitucional || ficha.correoPersonal) conCorreo++;
  }
  return { personas: salida, alertas, resumen: { funcionarios: Object.keys(salida).length, conCorreo, hoja: hoja.name } };
}
