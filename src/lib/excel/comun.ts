import ExcelJS from 'exceljs';
import { isoDe } from '../fechas.ts';

/** Error de formato que se le muestra tal cual a la administración (sin datos personales). */
export class ErrorFormato extends Error {}

type Celda = ExcelJS.Cell;
type Hoja = ExcelJS.Worksheet;

export async function abrirLibro(buffer: ArrayBuffer | Uint8Array): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  try {
    // exceljs acepta Buffer; Uint8Array/ArrayBuffer se convierten sin copiar.
    const datos = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    await libro.xlsx.load(Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength) as never);
  } catch {
    throw new ErrorFormato('No se pudo leer el archivo. Revisa que sea un Excel (.xlsx) y que no esté protegido con contraseña.');
  }
  return libro;
}

/**
 * Valor "útil" de una celda: resultado de fórmulas, texto enriquecido, hipervínculos.
 * exceljs no entrega el resultado 0 de las fórmulas compartidas (el XML sí lo tiene), por eso
 * una fórmula sin resultado se lee como 0.
 */
export function valor(celda: Celda): unknown {
  const v = celda.value as unknown;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('formula' in o || 'sharedFormula' in o) {
      const r = o.result;
      if (r === undefined || r === null) return 0;
      if (typeof r === 'object' && !(r instanceof Date) && (r as { error?: unknown }).error) return null;
      return r;
    }
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if (typeof o.text === 'string') return o.text;
    if (o.error) return null;
    return null;
  }
  return v;
}

export function esFormula(celda: Celda): boolean {
  const v = celda.value as unknown;
  return !!v && typeof v === 'object' && !(v instanceof Date) && ('formula' in (v as object) || 'sharedFormula' in (v as object));
}

export function texto(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isoDe(v);
  if (typeof v === 'object') return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/** Número; vacío = 0; texto con coma decimal se acepta; si no es número, NaN. */
export function numero(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const x = Number(v.replace(',', '.').trim());
    return Number.isNaN(x) ? Number.NaN : x;
  }
  return Number.NaN;
}

/** Fecha desde una celda: fecha de Excel o texto "dd/mm/aaaa" / "dd-mm-aaaa". Devuelve AAAA-MM-DD. */
export function fecha(v: unknown): string | null {
  if (v instanceof Date) return isoDe(new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())));
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return isoDe(new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))));
  }
  return null;
}

const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

/** Celdas con formato [h]:mm: Excel guarda días; exceljs las entrega como fecha. */
export function horasDeCeldaDeTiempo(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (v instanceof Date) return (v.getTime() - EPOCA_EXCEL) / 3_600_000;
  if (typeof v === 'number') return v * 24;
  return Number.NaN;
}

/** Celdas donde se escriben horas como número (8 = 8 horas). */
export function horasDeCeldaNumerica(v: unknown): number {
  if (v instanceof Date) return (v.getTime() - EPOCA_EXCEL) / 3_600_000;
  return numero(v);
}

/** Normaliza un encabezado: mayúsculas, sin tildes, espacios simples. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buscarHoja(libro: ExcelJS.Workbook, nombre: string): Hoja | undefined {
  const objetivo = normalizar(nombre);
  const candidatas = libro.worksheets.filter((h) => normalizar(h.name) === objetivo);
  return candidatas.find((h) => h.state === 'visible') ?? candidatas[0];
}

/** Primera fila (dentro de las primeras 10) que contiene todos los encabezados pedidos. */
export function filaDeEncabezados(hoja: Hoja, requeridos: string[]): number | null {
  const req = requeridos.map(normalizar);
  for (let r = 1; r <= Math.min(10, hoja.rowCount); r++) {
    const vistos = new Set<string>();
    hoja.getRow(r).eachCell({ includeEmpty: false }, (c) => vistos.add(normalizar(texto(valor(c)))));
    if (req.every((x) => vistos.has(x))) return r;
  }
  return null;
}

/**
 * Mapa encabezado → columna. Si hay fila de grupos (celdas combinadas arriba), también
 * registra "GRUPO|ENCABEZADO" para distinguir columnas repetidas (ej. ENERO en dos grupos).
 */
export function mapaDeColumnas(hoja: Hoja, filaEncabezado: number, filaGrupos?: number): Map<string, number> {
  const mapa = new Map<string, number>();
  hoja.getRow(filaEncabezado).eachCell({ includeEmpty: false }, (c, col) => {
    const h = normalizar(texto(valor(c)));
    if (!h) return;
    if (filaGrupos) {
      const g = normalizar(texto(valor(hoja.getRow(filaGrupos).getCell(col))));
      if (g) mapa.set(`${g}|${h}`, col);
    }
    if (!mapa.has(h)) mapa.set(h, col);
  });
  return mapa;
}

export function columna(mapa: Map<string, number>, clave: string, donde: string): number {
  const col = mapa.get(normalizar(clave).replace(/ \| /g, '|'));
  if (!col) throw new ErrorFormato(`No encuentro la columna "${clave}" en la hoja "${donde}". ¿Cambió el formato del Excel?`);
  return col;
}

export function columnaOpcional(mapa: Map<string, number>, ...claves: string[]): number | undefined {
  for (const c of claves) {
    const col = mapa.get(normalizar(c));
    if (col) return col;
  }
  return undefined;
}

/** Tokens de un nombre, para sugerir coincidencias. */
export function tokensNombre(s: string): string[] {
  return normalizar(s)
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
