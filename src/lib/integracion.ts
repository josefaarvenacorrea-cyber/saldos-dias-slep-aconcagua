/**
 * Lo que los flujos de Power Automate necesitan saber de cada documento emitido: en qué carpeta
 * del SharePoint se archiva, a qué base de Excel alimenta, y cómo se reparten los días entre los
 * meses de la hoja de saldos.
 *
 * Vive aparte de la base de datos para poder probarlo solo.
 */

import { esNoHabil, type DiaPedido, type TipoPermiso } from './reglasPermisos.ts';

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? '';
}

/**
 * Carpetas del sitio de SharePoint "Permisos y Feriados". La clave es lo estable: el flujo la usa
 * para elegir la carpeta, así que si allá le cambian el nombre a una, se arregla aquí y nada más.
 */
export type ClaveCarpeta = 'feriado-legal' | 'con-goce' | 'complementarios' | 'otros' | 'postergacion';

/**
 * Los nombres van tal como están escritos en la biblioteca, verificados contra el SharePoint el
 * 23-11-2026. SharePoint no distingue mayúsculas al resolver una ruta, pero sí la palabra: dos de
 * estos no eran variantes de caja sino nombres distintos de los que yo había supuesto.
 */
export const CARPETAS: Record<ClaveCarpeta, string> = {
  'feriado-legal': 'FERIADO LEGAL',
  'con-goce': 'CON GOCE DE REMUNERACIONES',
  complementarios: 'DESCANSO COMPLEMENTARIO',
  otros: 'OTROS PERMISOS',
  postergacion: 'POSTERGACION FL',
};

export function carpetaDe(tipo: TipoPermiso): ClaveCarpeta {
  if (tipo === 'feriado') return 'feriado-legal';
  if (tipo === 'goce') return 'con-goce';
  if (tipo === 'compensatorio') return 'complementarios';
  // El interferiado y los demás permisos se archivan juntos en "Otros permisos".
  return 'otros';
}

/** La base de Excel que tiene que registrar el permiso. */
export type BaseDestino = 'dias' | 'descansos' | 'interferiados' | 'ninguna';

export function baseDe(tipo: TipoPermiso): BaseDestino {
  if (tipo === 'feriado' || tipo === 'goce') return 'dias';
  if (tipo === 'compensatorio') return 'descansos';
  if (tipo === 'interferiado') return 'interferiados';
  // Los otros permisos quedan archivados en el SharePoint, sin base que los lleve.
  return 'ninguna';
}

/** El tipo como lo escriben las bases de Excel, que no es el mismo texto de la pantalla. */
export const TIPO_EXCEL: Record<TipoPermiso, string | null> = {
  feriado: 'Feriado Legal',
  goce: 'Con Goce de Remuneraciones',
  compensatorio: 'Descanso Complementario',
  interferiado: null,
  otros: null,
};

export interface CargoMes {
  anio: number;
  mes: number;
  mesNombre: string;
  dias: number;
}

/**
 * Reparte los días del permiso entre los meses en que efectivamente se toman, que es como se
 * cargan en la hoja de saldos. Un permiso que empieza el 30 de junio y termina el 3 de julio deja
 * un día en junio y los demás en julio, no cuatro en junio.
 *
 * Los sábados, domingos y feriados no se cuentan, igual que en totalDias.
 */
export function cargosPorMes(dias: DiaPedido[]): CargoMes[] {
  const suma = new Map<string, CargoMes>();
  for (const d of dias) {
    if (esNoHabil(d.fecha)) continue;
    const [anio, mes] = d.fecha.split('-').map(Number);
    const clave = `${anio}-${mes}`;
    const actual = suma.get(clave) ?? { anio, mes, mesNombre: nombreMes(mes), dias: 0 };
    actual.dias += d.jornada === 'completa' ? 1 : 0.5;
    suma.set(clave, actual);
  }
  return [...suma.values()]
    .map((c) => ({ ...c, dias: Math.round(c.dias * 2) / 2 }))
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}

/** El primer y el último día del permiso, ya ordenados. */
export function rangoDe(dias: DiaPedido[]): { desde: string | null; hasta: string | null } {
  if (dias.length === 0) return { desde: null, hasta: null };
  const fechas = dias.map((d) => d.fecha).sort();
  return { desde: fechas[0], hasta: fechas[fechas.length - 1] };
}

/** Año con que se archiva: el del primer día del permiso. */
export function anioDe(dias: DiaPedido[], porDefecto: number): number {
  const { desde } = rangoDe(dias);
  return desde ? Number(desde.slice(0, 4)) : porDefecto;
}

/**
 * El cursor con que el flujo va avanzando. Lleva la fecha en que se resolvió el documento y su id,
 * porque dos documentos pueden caer en el mismo milisegundo y con la fecha sola uno se perdería.
 */
export interface Cursor {
  en: string;
  id: number;
}

export function escribirCursor(c: Cursor): string {
  return `${c.en}|${c.id}`;
}

/** Lee un cursor. Acepta una fecha sola, por si el flujo parte con la hora de su última corrida. */
export function leerCursor(crudo: string | null): Cursor | null {
  if (!crudo) return null;
  const corte = crudo.lastIndexOf('|');
  const fecha = corte === -1 ? crudo : crudo.slice(0, corte);
  const id = corte === -1 ? 0 : Number(crudo.slice(corte + 1));
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime()) || !Number.isFinite(id) || id < 0) return null;
  return { en: d.toISOString(), id: Math.floor(id) };
}

/** Compara dos tokens en tiempo constante, para no filtrar el secreto por el tiempo de respuesta. */
export function tokenCalza(esperado: string, enviado: string): boolean {
  if (esperado.length === 0 || enviado.length !== esperado.length) return false;
  let distintos = 0;
  for (let i = 0; i < esperado.length; i++) distintos |= esperado.charCodeAt(i) ^ enviado.charCodeAt(i);
  return distintos === 0;
}

/** El token que trae la petición, sea en la cabecera Authorization o en la query. */
export function tokenDe(req: Request): string | null {
  const cabecera = req.headers.get('authorization') ?? '';
  if (cabecera.startsWith('Bearer ')) return cabecera.slice(7);
  return new URL(req.url).searchParams.get('token');
}

/** Si la petición viene de un flujo autorizado. */
export function esIntegracion(req: Request): boolean {
  const esperado = process.env.TOKEN_INTEGRACION;
  const enviado = tokenDe(req);
  if (!esperado || !enviado) return false;
  return tokenCalza(esperado, enviado);
}
