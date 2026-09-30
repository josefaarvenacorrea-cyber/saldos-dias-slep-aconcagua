import type { Alerta, FichaDescansos, HorasReconocidas, ResultadoLectura, Solicitud } from '../tipos.ts';
import { limpiarRut, numeroRut, rutValido, dvDe } from '../rut.ts';
import { esDiaHabil, fechaCorta } from '../fechas.ts';
import {
  abrirLibro,
  buscarHoja,
  columna,
  columnaOpcional,
  ErrorFormato,
  esFormula,
  fecha,
  filaDeEncabezados,
  horasDeCeldaDeTiempo,
  horasDeCeldaNumerica,
  mapaDeColumnas,
  normalizar,
  redondear,
  texto,
  valor,
} from './comun.ts';

const G_REC = 'DESCANSO COMPLEMENTARIO (HORAS RECONOCIDAS)';
const G_USO = 'DESCANSO COMPLEMENTARIO (HORAS UTILIZADAS)';
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const n2 = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(redondear(n));
const claveRex = (s: string) => normalizar(s).replace(/[^A-Z0-9]/g, ''); // "REX. 192" → "REX192"

/** Etiqueta legible para una columna de horas reconocidas. */
function fuenteDe(encabezado: string): string {
  const m = encabezado.match(/REX\.?\s*(\d+)/i);
  if (m) return `Resolución Exenta N° ${m[1]}`;
  const mes = MESES.indexOf(normalizar(encabezado));
  if (mes >= 0) return `Horas reconocidas en ${MESES[mes].toLowerCase()}`;
  return encabezado;
}

interface Persona extends FichaDescansos {
  fila: number;
  porColumna: Map<string, number>;
}

/** Lee "Base de Saldos de Descansos Complementarios": hoja resumen, Detalle Uso y hojas REX. */
export async function leerDescansos(buffer: ArrayBuffer | Uint8Array): Promise<ResultadoLectura<FichaDescansos>> {
  const libro = await abrirLibro(buffer);
  const hR = buscarHoja(libro, 'DESCANSOS COMPLEMENTARIOS');
  const hD = buscarHoja(libro, 'Detalle Uso');
  if (!hR || !hD) {
    throw new ErrorFormato('El archivo debe tener las hojas "DESCANSOS COMPLEMENTARIOS" y "Detalle Uso". ¿Es la Base de Saldos de Descansos Complementarios?');
  }
  const alertas: Alerta[] = [];
  const alerta = (a: Omit<Alerta, 'archivo'>) => alertas.push({ archivo: 'descansos', ...a });

  // ---------- hojas de resoluciones (REX) ----------
  const rex = new Map<string, Map<string, { horas: number; vence: string | null; fila: number; nombre: string }>>();
  for (const hoja of libro.worksheets.filter((h) => /^REX/i.test(h.name.trim()))) {
    const f = filaDeEncabezados(hoja, ['RUT']);
    if (!f) continue;
    const m = mapaDeColumnas(hoja, f);
    const cRut = m.get('RUT');
    const cHoras = [...m.entries()].find(([k]) => k.startsWith('N° HORAS DIURNAS INCR'))?.[1];
    const cVence = [...m.entries()].find(([k]) => k.startsWith('FECHA EXPIRA'))?.[1];
    const cNombre = m.get('NOMBRE COMPLETO');
    if (!cRut || !cHoras) {
      alerta({ nivel: 'media', hoja: hoja.name, fila: f, rut: '', nombre: '', alerta: 'No se reconocen las columnas de la resolución', detalle: 'Se esperaba "RUT" y "N° HORAS DIURNAS INCR. EN 25%".' });
      continue;
    }
    const porRut = new Map<string, { horas: number; vence: string | null; fila: number; nombre: string }>();
    for (let r = f + 1; r <= hoja.rowCount; r++) {
      const fila = hoja.getRow(r);
      const rut = numeroRut(valor(fila.getCell(cRut)));
      if (!rut) continue;
      const h = horasDeCeldaDeTiempo(valor(fila.getCell(cHoras)));
      const previo = porRut.get(rut);
      porRut.set(rut, {
        horas: (previo?.horas ?? 0) + (Number.isNaN(h) ? 0 : h),
        vence: previo?.vence ?? (cVence ? fecha(valor(fila.getCell(cVence))) : null),
        fila: previo?.fila ?? r,
        nombre: previo?.nombre ?? (cNombre ? texto(valor(fila.getCell(cNombre))) : ''),
      });
    }
    rex.set(claveRex(hoja.name), porRut);
  }

  // ---------- hoja resumen ----------
  const fR = filaDeEncabezados(hR, ['RUT-DV', 'NOMBRE COMPLETO']);
  if (!fR) throw new ErrorFormato('No encuentro los encabezados (RUT-DV, NOMBRE COMPLETO) en la hoja DESCANSOS COMPLEMENTARIOS.');
  const mR = mapaDeColumnas(hR, fR, fR > 1 ? fR - 1 : undefined);
  const cRut = columna(mR, 'RUT-DV', 'DESCANSOS COMPLEMENTARIOS');
  const cNombre = columna(mR, 'NOMBRE COMPLETO', 'DESCANSOS COMPLEMENTARIOS');
  const cArea = columnaOpcional(mR, 'ÁREA/SUBDIRECCIÓN');
  const colsRec: { col: number; h: string }[] = [];
  const colsUso: { col: number; mes: number }[] = [];
  hR.getRow(fR).eachCell({ includeEmpty: false }, (celda, col) => {
    const g = fR > 1 ? normalizar(texto(valor(hR.getRow(fR - 1).getCell(col)))) : '';
    const h = texto(valor(celda));
    const hn = normalizar(h);
    if (g === G_REC && !hn.startsWith('SALDO')) colsRec.push({ col, h });
    if (g === G_USO && MESES.includes(hn)) colsUso.push({ col, mes: MESES.indexOf(hn) });
  });
  if (!colsRec.length) throw new ErrorFormato('No encuentro las columnas de horas reconocidas en la hoja DESCANSOS COMPLEMENTARIOS.');

  const personas = new Map<string, Persona>();
  for (let r = fR + 1; r <= hR.rowCount; r++) {
    const fila = hR.getRow(r);
    const rutTexto = texto(valor(fila.getCell(cRut)));
    if (!rutTexto) continue;
    const rut = numeroRut(rutTexto);
    const nombre = texto(valor(fila.getCell(cNombre)));
    const base = { hoja: 'DESCANSOS COMPLEMENTARIOS', fila: r, rut: rutTexto, nombre };
    if (!rutValido(rutTexto)) alerta({ ...base, nivel: 'alta', alerta: 'RUT con dígito verificador inválido', detalle: `Para el número ${rut} el dígito verificador correcto es ${dvDe(rut)}.` });
    if (personas.has(rut)) {
      alerta({ ...base, nivel: 'alta', alerta: 'RUT repetido en la hoja resumen', detalle: `Ya aparece en la fila ${personas.get(rut)!.fila}. Se usa la primera.` });
      continue;
    }
    const reconocidas: HorasReconocidas[] = [];
    const porColumna = new Map<string, number>();
    for (const { col, h } of colsRec) {
      const celda = fila.getCell(col);
      const v = valor(celda);
      const horas = horasDeCeldaDeTiempo(v);
      if (Number.isNaN(horas)) {
        alerta({ ...base, nivel: 'alta', alerta: `Valor no válido en horas reconocidas (${h})`, detalle: `Celda ${celda.address}.` });
        continue;
      }
      if (!esFormula(celda) && typeof v === 'number' && v >= 1) {
        alerta({ ...base, nivel: 'alta', alerta: 'Número escrito en una celda de horas', detalle: `La celda ${celda.address} tiene ${v}; Excel lo interpreta como ${v * 24} horas. Si son ${v} horas, escríbelo como ${v}:00.` });
      }
      porColumna.set(claveRex(h), horas);
      if (horas > 1e-9) {
        const vence = rex.get(claveRex(h))?.get(rut)?.vence ?? null;
        reconocidas.push({ fuente: fuenteDe(h), horas: redondear(horas), vence });
      }
    }
    const usoMes = Array(12).fill(0) as number[];
    for (const { col, mes } of colsUso) {
      const celda = fila.getCell(col);
      const v = valor(celda);
      const horas = horasDeCeldaDeTiempo(v);
      if (Number.isNaN(horas)) continue;
      if (!esFormula(celda) && typeof v === 'number' && v >= 1) {
        alerta({ ...base, nivel: 'alta', alerta: 'Número escrito en una celda de horas', detalle: `La celda ${celda.address} tiene ${v}; Excel lo interpreta como ${v * 24} horas.` });
      }
      usoMes[mes] += horas;
    }
    const total = reconocidas.reduce((a, x) => a + x.horas, 0);
    personas.set(rut, {
      fila: r,
      rut,
      rutTexto: limpiarRut(rutTexto),
      nombre,
      area: cArea ? texto(valor(fila.getCell(cArea))) : '',
      reconocidas,
      totalReconocidas: redondear(total),
      usadas: 0,
      usadasSegunResumen: redondear(usoMes.reduce((a, b) => a + b, 0)),
      saldo: 0,
      solicitudes: [],
      porColumna,
    });
  }

  // Coherencia entre la hoja resumen y cada hoja REX.
  for (const [clave, porRut] of rex) {
    for (const [rut, x] of porRut) {
      const p = personas.get(rut);
      if (!p) {
        alerta({ nivel: 'alta', hoja: clave.replace(/^REX/, 'REX. '), fila: x.fila, rut, nombre: x.nombre, alerta: 'Horas reconocidas de una persona que no está en la hoja resumen', detalle: `${n2(x.horas)} h que hoy no se suman a ningún saldo.` });
        continue;
      }
      const enResumen = p.porColumna.get(clave);
      if (enResumen !== undefined && Math.abs(enResumen - x.horas) > 0.01) {
        alerta({ nivel: 'alta', hoja: 'DESCANSOS COMPLEMENTARIOS', fila: p.fila, rut: p.rutTexto, nombre: p.nombre, alerta: 'Horas de la resolución no coinciden con la hoja resumen', detalle: `Resumen: ${n2(enResumen)} h · hoja ${clave.replace(/^REX/, 'REX. ')}: ${n2(x.horas)} h. ¿Falta actualizar la tabla dinámica o la fórmula?` });
      }
    }
  }

  // ---------- Detalle Uso ----------
  const fD = filaDeEncabezados(hD, ['RUT-DV']);
  if (!fD) throw new ErrorFormato('No encuentro el encabezado RUT-DV en la hoja Detalle Uso.');
  const mD = mapaDeColumnas(hD, fD);
  const d = {
    rut: columna(mD, 'RUT-DV', 'Detalle Uso'),
    nombre: columnaOpcional(mD, 'NOMBRE COMPLETO'),
    tipo: columnaOpcional(mD, 'TIPO'),
    horas: columna(mD, 'N° HORAS', 'Detalle Uso'),
    inicio: columna(mD, 'FECHA INICIO', 'Detalle Uso'),
    comentario: columnaOpcional(mD, 'COMENTARIOS', 'COMENTARIO'),
  };
  const vistas = new Map<string, number>();
  let repetidas = 0;
  let total = 0;
  for (let r = fD + 1; r <= hD.rowCount; r++) {
    const fila = hD.getRow(r);
    const rutEscrito = texto(valor(fila.getCell(d.rut)));
    const hV = valor(fila.getCell(d.horas));
    const inicio = fecha(valor(fila.getCell(d.inicio)));
    if (!rutEscrito && !texto(hV) && !inicio) continue;
    const nombre = d.nombre ? texto(valor(fila.getCell(d.nombre))) : '';
    const base = { hoja: 'Detalle Uso', fila: r, rut: rutEscrito, nombre };
    const rut = numeroRut(rutEscrito);
    const horas = horasDeCeldaNumerica(hV);
    if (!rut) { alerta({ ...base, nivel: 'alta', alerta: 'Solicitud sin RUT', detalle: '' }); continue; }
    const p = personas.get(rut);
    if (Number.isNaN(horas) || horas <= 0) alerta({ ...base, nivel: 'alta', alerta: 'N° de horas vacío, cero o no numérico', detalle: 'La fila no se descuenta hasta que tenga horas.' });
    if (!inicio) alerta({ ...base, nivel: 'alta', alerta: 'Sin fecha', detalle: 'No se puede mostrar en el calendario.' });
    else if (!esDiaHabil(inicio)) alerta({ ...base, nivel: 'media', alerta: 'Fecha en fin de semana o feriado', detalle: fechaCorta(inicio) });
    if (!p) { alerta({ ...base, nivel: 'alta', alerta: 'RUT no está en la hoja DESCANSOS COMPLEMENTARIOS', detalle: `${n2(Number.isNaN(horas) ? 0 : horas)} h que no se descuentan de ningún saldo.` }); continue; }
    if (limpiarRut(rutEscrito) !== p.rutTexto && rutValido(p.rutTexto)) {
      alerta({ ...base, nivel: 'media', alerta: 'RUT-DV distinto al de la hoja resumen', detalle: `Dice ${limpiarRut(rutEscrito)}; en la hoja resumen es ${p.rutTexto}. Se asigna igual por el número de RUT.` });
    }
    if (Number.isNaN(horas) || horas <= 0) continue;
    if (inicio) {
      const clave = [rut, inicio, horas].join('|');
      const previa = vistas.get(clave);
      if (previa) {
        repetidas++;
        alerta({ ...base, nivel: 'alta', alerta: 'Solicitud repetida', detalle: `Es igual a la fila ${previa}. Se cuenta una sola vez.` });
        continue;
      }
      vistas.set(clave, r);
    }
    const comentario = d.comentario ? texto(valor(fila.getCell(d.comentario))) || null : null;
    const sol: Solicitud = {
      fila: r,
      tipo: 'descanso',
      tipoTexto: (d.tipo && texto(valor(fila.getCell(d.tipo)))) || 'Descanso complementario',
      cantidad: redondear(horas),
      unidad: 'horas',
      inicio,
      termino: inicio,
      comentario,
      reparto: inicio ? [{ fecha: inicio, fraccion: Math.min(1, horas / 8) }] : [],
    };
    p.solicitudes.push(sol);
    total++;
  }

  const salida: Record<string, FichaDescansos> = {};
  for (const p of personas.values()) {
    p.usadas = redondear(p.solicitudes.reduce((a, s) => a + s.cantidad, 0));
    p.saldo = redondear(p.totalReconocidas - p.usadas);
    p.solicitudes.sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '') || a.fila - b.fila);
    if (Math.abs(p.usadas - p.usadasSegunResumen) > 0.01) {
      const menos = p.usadas < p.usadasSegunResumen;
      alerta({ nivel: menos ? 'alta' : 'media', hoja: 'DESCANSOS COMPLEMENTARIOS', fila: p.fila, rut: p.rutTexto, nombre: p.nombre, alerta: 'Descuadre en horas usadas', detalle: `Detalle Uso suma ${n2(p.usadas)} h y el resumen mensual ${n2(p.usadasSegunResumen)} h. ${menos ? 'Faltan solicitudes en Detalle Uso o el resumen tiene horas de más: la persona ve más saldo del que tendría.' : 'Falta digitar en el resumen o hay solicitudes de más en Detalle Uso.'}` });
    }
    if (p.saldo < -0.01) {
      alerta({ nivel: 'alta', hoja: 'DESCANSOS COMPLEMENTARIOS', fila: p.fila, rut: p.rutTexto, nombre: p.nombre, alerta: 'Saldo negativo de horas', detalle: `Reconocidas ${n2(p.totalReconocidas)} h y usadas ${n2(p.usadas)} h. ¿Falta cargar una resolución o hay horas mal digitadas?` });
    }
    const { fila: _f, porColumna: _c, ...ficha } = p;
    salida[p.rut] = ficha;
  }
  return { personas: salida, alertas, resumen: { funcionarios: personas.size, solicitudes: total, repetidas, resoluciones: rex.size } };
}
