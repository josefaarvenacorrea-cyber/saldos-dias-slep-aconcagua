import type { Alerta, FichaDias, ResultadoLectura, Solicitud, TipoSolicitud } from '../tipos.ts';
import { limpiarRut, numeroRut, rutValido, dvDe } from '../rut.ts';
import { repartirDiasHabiles, diasHabilesEntre, esDiaHabil, esFeriado, fechaCorta, nombreDia, sumarDias } from '../fechas.ts';
import {
  abrirLibro,
  buscarHoja,
  columna,
  columnaOpcional,
  ErrorFormato,
  esFormula,
  fecha,
  filaDeEncabezados,
  mapaDeColumnas,
  numero,
  redondear,
  texto,
  tokensNombre,
  valor,
} from './comun.ts';

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const G_ADM = 'PERMISO ADMINISTRATIVO';
const G_FL = 'FERIADO LEGAL';

const TIPOS: Record<string, TipoSolicitud> = {
  'CON GOCE DE REMUNERACIONES': 'administrativo',
  'PERMISO ADMINISTRATIVO': 'administrativo',
  'FERIADO LEGAL': 'feriado_legal',
};

const n2 = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(redondear(n));

interface Persona extends FichaDias {
  fila: number;
  mesesResumenAdm: number[];
  mesesResumenFl: number[];
}

/** Lee "Base de Saldos de Días": hojas SALDOS y Detalle uso. El resto de las hojas se ignora. */
export async function leerDias(buffer: ArrayBuffer | Uint8Array): Promise<ResultadoLectura<FichaDias>> {
  const libro = await abrirLibro(buffer);
  const hS = buscarHoja(libro, 'SALDOS');
  const hD = buscarHoja(libro, 'Detalle uso');
  if (!hS || !hD) {
    throw new ErrorFormato('El archivo debe tener las hojas "SALDOS" y "Detalle uso". ¿Es la Base de Saldos de Días?');
  }
  const alertas: Alerta[] = [];
  const alerta = (a: Omit<Alerta, 'archivo'>) => alertas.push({ archivo: 'dias', ...a });

  // ---------- SALDOS ----------
  const fS = filaDeEncabezados(hS, ['RUT-DV', 'NOMBRE COMPLETO']);
  if (!fS) throw new ErrorFormato('No encuentro los encabezados (RUT-DV, NOMBRE COMPLETO) en la hoja SALDOS.');
  const mS = mapaDeColumnas(hS, fS, fS > 1 ? fS - 1 : undefined);
  const c = {
    rut: columna(mS, 'RUT-DV', 'SALDOS'),
    nombre: columna(mS, 'NOMBRE COMPLETO', 'SALDOS'),
    area: columnaOpcional(mS, 'ÁREA/SUBDIRECCIÓN', 'AREA/SUBDIRECCION'),
    admIni: columna(mS, `${G_ADM}|SALDO INICIAL DÍAS ADMINISTRATIVOS`, 'SALDOS'),
    admMes: MESES.map((m) => columna(mS, `${G_ADM}|${m}`, 'SALDOS')),
    flAcum: columna(mS, `${G_FL}|DÍAS ACUMULADOS AÑO ANTERIOR`, 'SALDOS'),
    flAnual: columna(mS, `${G_FL}|DIAS ANUALIDAD`, 'SALDOS'),
    flMes: MESES.map((m) => columna(mS, `${G_FL}|${m}`, 'SALDOS')),
    otros: columnaOpcional(mS, 'USO DE OTROS PERMISOS ESPECIALES'),
  };

  const personas = new Map<string, Persona>();
  for (let r = fS + 1; r <= hS.rowCount; r++) {
    const fila = hS.getRow(r);
    const rutTexto = texto(valor(fila.getCell(c.rut)));
    const nombre = texto(valor(fila.getCell(c.nombre)));
    if (!rutTexto) {
      if (nombre) alerta({ nivel: 'alta', hoja: 'SALDOS', fila: r, rut: '', nombre, alerta: 'Fila con nombre pero sin RUT', detalle: 'Esta persona no puede ver su información hasta que tenga RUT.' });
      continue;
    }
    const rut = numeroRut(rutTexto);
    if (!rutValido(rutTexto)) {
      alerta({ nivel: 'alta', hoja: 'SALDOS', fila: r, rut: rutTexto, nombre, alerta: 'RUT con dígito verificador inválido', detalle: `Para el número ${rut} el dígito verificador correcto es ${dvDe(rut)}. Revisa si el error está en el número o en el dígito.` });
    }
    if (personas.has(rut)) {
      alerta({ nivel: 'alta', hoja: 'SALDOS', fila: r, rut: rutTexto, nombre, alerta: 'RUT repetido en SALDOS', detalle: `Ya aparece en la fila ${personas.get(rut)!.fila}. Se usa la primera.` });
      continue;
    }
    const leerMeses = (cols: number[], etiqueta: string) =>
      cols.map((col, m) => {
        const x = numero(valor(fila.getCell(col)));
        if (Number.isNaN(x)) {
          alerta({ nivel: 'alta', hoja: 'SALDOS', fila: r, rut: rutTexto, nombre, alerta: `Valor no numérico en ${etiqueta} (${MESES[m].toLowerCase()})`, detalle: `Celda ${fila.getCell(col).address}. Se contó como 0.` });
          return 0;
        }
        return x;
      });
    const admIni = numero(valor(fila.getCell(c.admIni)));
    const flAcum = numero(valor(fila.getCell(c.flAcum)));
    const flAnual = numero(valor(fila.getCell(c.flAnual)));
    if ([admIni, flAcum, flAnual].some(Number.isNaN)) {
      alerta({ nivel: 'alta', hoja: 'SALDOS', fila: r, rut: rutTexto, nombre, alerta: 'Saldo inicial no numérico', detalle: 'Revisa las columnas de saldo inicial, días acumulados y días de anualidad. Se contaron como 0.' });
    }
    const otros = c.otros ? texto(valor(fila.getCell(c.otros))) : '';
    personas.set(rut, {
      fila: r,
      rut,
      rutTexto: limpiarRut(rutTexto),
      nombre,
      area: c.area ? texto(valor(fila.getCell(c.area))) : '',
      anio: 0,
      administrativos: { inicial: Number.isNaN(admIni) ? 0 : admIni, usados: 0, saldo: 0, usadosSegunResumen: 0 },
      feriadoLegal: {
        acumuladoAnterior: Number.isNaN(flAcum) ? 0 : flAcum,
        anualidad: Number.isNaN(flAnual) ? 0 : flAnual,
        inicial: (Number.isNaN(flAcum) ? 0 : flAcum) + (Number.isNaN(flAnual) ? 0 : flAnual),
        usados: 0,
        saldo: 0,
        usadosSegunResumen: 0,
      },
      otrosPermisos: otros && otros !== '0' ? otros : null,
      solicitudes: [],
      mesesResumenAdm: leerMeses(c.admMes, 'días administrativos'),
      mesesResumenFl: leerMeses(c.flMes, 'feriado legal'),
    });
  }
  if (personas.size === 0) throw new ErrorFormato('La hoja SALDOS no tiene funcionarios con RUT.');

  // ---------- Detalle uso ----------
  const fD = filaDeEncabezados(hD, ['RUT-DV', 'TIPO']);
  if (!fD) throw new ErrorFormato('No encuentro los encabezados (RUT-DV, Tipo) en la hoja Detalle uso.');
  const mD = mapaDeColumnas(hD, fD);
  const d = {
    rut: columna(mD, 'RUT-DV', 'Detalle uso'),
    rutNum: columnaOpcional(mD, 'RUT'),
    nombre: columnaOpcional(mD, 'NOMBRE COMPLETO'),
    tipo: columna(mD, 'TIPO', 'Detalle uso'),
    dias: columna(mD, 'N° DIAS', 'Detalle uso'),
    inicio: columna(mD, 'FECHA INICIO', 'Detalle uso'),
    termino: columnaOpcional(mD, 'FECHA TERMINO', 'FECHA TÉRMINO'),
    comentario: columnaOpcional(mD, 'COMENTARIOS', 'COMENTARIO'),
  };

  type Fila = Solicitud & { rut: string; rutEscrito: string; nombreFila: string; terminoEsFormula: boolean };
  const filas: Fila[] = [];
  const sinPersona: Fila[] = [];
  const anios = new Map<number, number>();
  let duplicados = 0;
  const vistas = new Map<string, number>();

  for (let r = fD + 1; r <= hD.rowCount; r++) {
    const fila = hD.getRow(r);
    const rutEscrito = texto(valor(fila.getCell(d.rut)));
    const tipoTexto = texto(valor(fila.getCell(d.tipo)));
    const cantV = valor(fila.getCell(d.dias));
    const inicio = fecha(valor(fila.getCell(d.inicio)));
    if (!rutEscrito && !tipoTexto && !inicio && !texto(cantV)) continue;

    const nombreFila = d.nombre ? texto(valor(fila.getCell(d.nombre))) : '';
    const rut = numeroRut(rutEscrito) || (d.rutNum ? numeroRut(valor(fila.getCell(d.rutNum))) : '');
    const cantidad = numero(cantV);
    const celdaTermino = d.termino ? fila.getCell(d.termino) : undefined;
    const termino = celdaTermino ? fecha(valor(celdaTermino)) : null;
    const comentario = d.comentario ? texto(valor(fila.getCell(d.comentario))) || null : null;
    const tipo: TipoSolicitud = TIPOS[tipoTexto.toUpperCase()] ?? 'otro';
    const base = { hoja: 'Detalle uso', fila: r, rut: rutEscrito, nombre: nombreFila };

    if (!rut) alerta({ ...base, nivel: 'alta', alerta: 'Solicitud sin RUT', detalle: `${tipoTexto || 'Sin tipo'}, ${texto(cantV)} día(s) desde ${fechaCorta(inicio)}.` });
    if (!tipoTexto) alerta({ ...base, nivel: 'alta', alerta: 'Solicitud sin tipo', detalle: 'No se descuenta de ningún saldo hasta que tenga tipo.' });
    else if (tipo === 'otro') alerta({ ...base, nivel: 'media', alerta: `Tipo no reconocido: "${tipoTexto}"`, detalle: 'Se muestra en el historial, pero no se descuenta de administrativos ni de feriado legal.' });
    if (Number.isNaN(cantidad) || cantidad <= 0) alerta({ ...base, nivel: 'alta', alerta: 'N° de días vacío, cero o no numérico', detalle: `Valor: "${texto(cantV)}".` });
    if (!inicio) alerta({ ...base, nivel: 'alta', alerta: 'Sin fecha de inicio', detalle: 'No se puede mostrar en el calendario.' });
    if (inicio) {
      const anio = Number(inicio.slice(0, 4));
      anios.set(anio, (anios.get(anio) ?? 0) + 1);
      if (!esDiaHabil(inicio)) alerta({ ...base, nivel: 'media', alerta: 'Fecha de inicio en fin de semana o feriado', detalle: `${fechaCorta(inicio)} (${nombreDia(inicio)}${esFeriado(inicio) ? ', feriado' : ''}).` });
    }
    if (rutEscrito && limpiarRut(rutEscrito) !== rutEscrito.toUpperCase()) {
      alerta({ ...base, nivel: 'baja', alerta: 'RUT con puntos o espacios', detalle: `Se leyó como ${limpiarRut(rutEscrito)}.` });
    }
    if (comentario && /pendiente|falta/i.test(comentario)) alerta({ ...base, nivel: 'seguimiento', alerta: 'Solicitud con pendiente', detalle: comentario });

    const reparto = inicio && cantidad > 0 && !Number.isNaN(cantidad) ? repartirDiasHabiles(inicio, cantidad) : [];
    if (inicio && cantidad > 1) {
      const ultimo = reparto.at(-1)?.fecha;
      if (termino && celdaTermino && !esFormula(celdaTermino)) {
        const habiles = diasHabilesEntre(inicio, termino);
        if (habiles !== Math.ceil(cantidad)) {
          alerta({ ...base, nivel: 'media', alerta: 'N° de días no coincide con los días hábiles entre las fechas', detalle: `${n2(cantidad)} día(s), pero entre ${fechaCorta(inicio)} y ${fechaCorta(termino)} hay ${habiles} día(s) hábil(es).` });
        }
      } else if (termino && ultimo && termino !== ultimo) {
        alerta({ ...base, nivel: 'media', alerta: 'Fecha de término calculada con días corridos', detalle: `La fórmula da ${fechaCorta(termino)}; contando ${n2(cantidad)} días hábiles termina el ${fechaCorta(ultimo)}.` });
      }
    }

    const sol: Fila = {
      fila: r,
      tipo,
      tipoTexto: tipoTexto || 'Sin tipo (en revisión)',
      cantidad: Number.isNaN(cantidad) ? 0 : cantidad,
      unidad: 'dias',
      inicio,
      termino: reparto.at(-1)?.fecha ?? termino ?? inicio,
      comentario,
      reparto,
      rut,
      rutEscrito,
      nombreFila,
      terminoEsFormula: celdaTermino ? esFormula(celdaTermino) : false,
    };

    // Duplicado exacto: misma persona, tipo, fecha de inicio y cantidad → se cuenta una vez.
    if (rut && inicio) {
      const clave = [rut, tipoTexto.toUpperCase(), inicio, cantidad].join('|');
      const previa = vistas.get(clave);
      if (previa) {
        duplicados++;
        alerta({ ...base, nivel: 'alta', alerta: 'Solicitud repetida', detalle: `Es igual a la fila ${previa}. Se cuenta una sola vez; conviene borrar una de las dos.` });
        continue;
      }
      vistas.set(clave, r);
    }

    const persona = personas.get(rut);
    if (!persona) {
      if (rut) sinPersona.push(sol);
      continue;
    }
    if (rutEscrito && limpiarRut(rutEscrito) !== persona.rutTexto && rutValido(persona.rutTexto)) {
      alerta({ ...base, nivel: 'media', alerta: 'RUT-DV distinto al de SALDOS', detalle: `Dice ${limpiarRut(rutEscrito)}; en SALDOS es ${persona.rutTexto}. La solicitud igual se asigna a la persona por el número de RUT. Suele pasar al arrastrar la celda hacia abajo: Excel le va sumando 1 al dígito.` });
    }
    filas.push(sol);
  }

  // RUT que no existen en SALDOS: sugerir coincidencia por nombre.
  const indice = [...personas.values()].map((p) => ({ p, t: new Set(tokensNombre(p.nombre)) }));
  for (const s of sinPersona) {
    const t = tokensNombre(s.nombreFila);
    let mejor: Persona | null = null;
    let puntaje = 0;
    for (const { p, t: tp } of indice) {
      const sc = t.filter((x) => tp.has(x)).length;
      if (sc > puntaje) { puntaje = sc; mejor = p; }
    }
    alerta({
      nivel: 'alta',
      hoja: 'Detalle uso',
      fila: s.fila,
      rut: s.rutEscrito,
      nombre: s.nombreFila,
      alerta: 'El número de RUT no está en SALDOS',
      detalle: mejor && puntaje >= 2 ? `El nombre coincide con ${mejor.nombre} (${mejor.rutTexto}). Probablemente el número está mal digitado.` : 'La persona no está en SALDOS: agrégala o revisa si la solicitud corresponde.',
    });
  }

  // Año de la base: el más frecuente en las fechas de inicio.
  const anio = [...anios.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? new Date().getFullYear();
  for (const s of filas) {
    if (s.inicio && Number(s.inicio.slice(0, 4)) !== anio) {
      alerta({ nivel: 'alta', hoja: 'Detalle uso', fila: s.fila, rut: s.rutEscrito, nombre: s.nombreFila, alerta: `Fecha de inicio fuera de ${anio}`, detalle: `Dice ${fechaCorta(s.inicio)}; ¿debería ser ${anio}?` });
    }
  }

  // ---------- cálculo por persona (regla: saldo = inicial − detalle, sin repetidos) ----------
  for (const p of personas.values()) {
    p.anio = anio;
    const propias = filas.filter((s) => s.rut === p.rut);
    p.solicitudes = propias
      .map(({ rut: _r, rutEscrito: _e, nombreFila: _n, terminoEsFormula: _t, ...s }) => s)
      .sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '') || a.fila - b.fila);
    const usados = (tipo: TipoSolicitud) => propias.filter((s) => s.tipo === tipo).reduce((acc, s) => acc + s.cantidad, 0);
    p.administrativos.usados = redondear(usados('administrativo'));
    p.administrativos.usadosSegunResumen = redondear(p.mesesResumenAdm.reduce((a, b) => a + b, 0));
    p.administrativos.saldo = redondear(p.administrativos.inicial - p.administrativos.usados);
    p.feriadoLegal.usados = redondear(usados('feriado_legal'));
    p.feriadoLegal.usadosSegunResumen = redondear(p.mesesResumenFl.reduce((a, b) => a + b, 0));
    p.feriadoLegal.saldo = redondear(p.feriadoLegal.inicial - p.feriadoLegal.usados);

    for (const [tipo, etiqueta, resumen, meses] of [
      ['administrativo', 'días administrativos', p.administrativos, p.mesesResumenAdm],
      ['feriado_legal', 'feriado legal', p.feriadoLegal, p.mesesResumenFl],
    ] as const) {
      const detalleMes = Array(12).fill(0) as number[];
      for (const s of propias.filter((x) => x.tipo === tipo)) for (const u of s.reparto) if (Number(u.fecha.slice(0, 4)) === anio) detalleMes[Number(u.fecha.slice(5, 7)) - 1] += u.fraccion;
      const difMeses = meses.map((v, m) => (Math.abs(v - detalleMes[m]) > 1e-9 ? `${MES_CORTO[m]}: SALDOS ${n2(v)} · detalle ${n2(detalleMes[m])}` : null)).filter(Boolean);
      if (Math.abs(resumen.usados - resumen.usadosSegunResumen) > 1e-9) {
        const menos = resumen.usados < resumen.usadosSegunResumen;
        alerta({
          nivel: menos ? 'alta' : 'media',
          hoja: 'SALDOS',
          fila: p.fila,
          rut: p.rutTexto,
          nombre: p.nombre,
          alerta: `Descuadre en ${etiqueta}`,
          detalle: `Detalle uso suma ${n2(resumen.usados)} y SALDOS suma ${n2(resumen.usadosSegunResumen)}. ${menos ? 'Faltan solicitudes en Detalle uso o SALDOS tiene días de más: la persona ve más saldo del que tendría.' : 'Falta digitar en SALDOS o hay solicitudes de más en Detalle uso.'}${difMeses.length ? ` Meses: ${difMeses.join('; ')}.` : ''}`,
        });
      }
      if (resumen.saldo < -1e-9) {
        alerta({ nivel: 'alta', hoja: 'SALDOS', fila: p.fila, rut: p.rutTexto, nombre: p.nombre, alerta: `Saldo negativo en ${etiqueta}`, detalle: `Saldo inicial ${n2(resumen.inicial)} y usados ${n2(resumen.usados)}.` });
      }
    }
  }

  // Dos solicitudes que cubren el mismo día (juntas más de un día).
  const porDia = new Map<string, Fila[]>();
  for (const s of filas) for (const u of s.reparto) {
    const k = `${s.rut}|${u.fecha}`;
    porDia.set(k, [...(porDia.get(k) ?? []), s]);
  }
  const pares = new Set<string>();
  for (const [k, lista] of porDia) {
    const fecha = k.split('|')[1];
    const total = lista.reduce((acc, s) => acc + (s.reparto.find((u) => u.fecha === fecha)?.fraccion ?? 0), 0);
    if (total <= 1 + 1e-9) continue;
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const clave = `${lista[i].fila}-${lista[j].fila}`;
      if (pares.has(clave)) continue;
      pares.add(clave);
      alerta({ nivel: 'media', hoja: 'Detalle uso', fila: lista[i].fila, rut: lista[i].rutEscrito, nombre: lista[i].nombreFila, alerta: 'Dos solicitudes el mismo día', detalle: `Se topa con la fila ${lista[j].fila} (${lista[j].tipoTexto}) desde el ${fechaCorta(fecha)}.` });
    }
  }

  const salida: Record<string, FichaDias> = {};
  for (const p of personas.values()) {
    const { fila: _f, mesesResumenAdm: _a, mesesResumenFl: _b, ...ficha } = p;
    salida[p.rut] = ficha;
  }
  return {
    personas: salida,
    alertas,
    resumen: { anio, funcionarios: personas.size, solicitudes: filas.length, repetidas: duplicados, sinPersona: sinPersona.length, ultimoDiaConDatos: filas.reduce((m, s) => (s.inicio && s.inicio > m ? s.inicio : m), '') || sumarDias(`${anio}-01-01`, 0) },
  };
}
