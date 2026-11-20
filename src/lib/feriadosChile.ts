/**
 * Feriados nacionales de Chile y días interferiados.
 *
 * Los feriados están escritos a mano porque dependen de leyes que cambian (la Ley 19.668 traslada
 * San Pedro y San Pablo y el Encuentro de Dos Mundos al lunes, la Ley 20.983 agrega el feriado
 * adicional de Fiestas Patrias en ciertos años), así que no se pueden calcular con una fórmula.
 * Cada vez que empiece un año nuevo hay que agregar su lista acá.
 *
 * No incluye feriados regionales: ninguna de las comunas del SLEP Aconcagua tiene uno.
 */

export const FERIADOS: Record<string, string> = {
  // 2026
  '2026-01-01': 'Año Nuevo',
  '2026-04-03': 'Viernes Santo',
  '2026-04-04': 'Sábado Santo',
  '2026-05-01': 'Día Nacional del Trabajo',
  '2026-05-21': 'Día de las Glorias Navales',
  '2026-06-21': 'Día Nacional de los Pueblos Indígenas',
  '2026-06-29': 'San Pedro y San Pablo',
  '2026-07-16': 'Virgen del Carmen',
  '2026-08-15': 'Asunción de la Virgen',
  '2026-09-18': 'Independencia Nacional',
  '2026-09-19': 'Día de las Glorias del Ejército',
  '2026-10-12': 'Encuentro de Dos Mundos',
  '2026-10-31': 'Día de las Iglesias Evangélicas y Protestantes',
  '2026-11-01': 'Día de Todos los Santos',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Navidad',
  // 2027
  '2027-01-01': 'Año Nuevo',
  '2027-03-26': 'Viernes Santo',
  '2027-03-27': 'Sábado Santo',
  '2027-05-01': 'Día Nacional del Trabajo',
  '2027-05-21': 'Día de las Glorias Navales',
  '2027-06-21': 'Día Nacional de los Pueblos Indígenas',
  '2027-06-28': 'San Pedro y San Pablo',
  '2027-07-16': 'Virgen del Carmen',
  '2027-08-15': 'Asunción de la Virgen',
  '2027-09-17': 'Feriado adicional de Fiestas Patrias',
  '2027-09-18': 'Independencia Nacional',
  '2027-09-19': 'Día de las Glorias del Ejército',
  '2027-10-11': 'Encuentro de Dos Mundos',
  '2027-10-31': 'Día de las Iglesias Evangélicas y Protestantes',
  '2027-11-01': 'Día de Todos los Santos',
  '2027-12-08': 'Inmaculada Concepción',
  '2027-12-25': 'Navidad',
};

/** Años que alcanza este calendario. Fuera de ellos no se puede decidir si un día es interferiado. */
export const ANIOS_CON_CALENDARIO = [...new Set(Object.keys(FERIADOS).map((f) => Number(f.slice(0, 4))))].sort();

export function esFeriado(fecha: string): boolean {
  return fecha in FERIADOS;
}

export function nombreFeriado(fecha: string): string | null {
  return FERIADOS[fecha] ?? null;
}

function aFecha(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function aIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** El día siguiente, en formato YYYY-MM-DD. */
export function diaSiguiente(fecha: string): string {
  const d = aFecha(fecha);
  d.setDate(d.getDate() + 1);
  return aIso(d);
}

/** Día de trabajo: ni sábado, ni domingo, ni feriado. */
export function esDiaHabil(fecha: string): boolean {
  const dia = aFecha(fecha).getDay();
  return dia !== 0 && dia !== 6 && !esFeriado(fecha);
}

/**
 * Día interferiado: un día hábil justo antes de un feriado.
 *
 * Es la regla que define cuándo se puede pedir el permiso por interferiado, que es un permiso que
 * solo existe para esos días. Si el calendario no cubre el año, devuelve false, porque sin los
 * feriados de ese año no hay forma de saberlo.
 */
export function esInterferiado(fecha: string): boolean {
  if (!esDiaHabil(fecha)) return false;
  return esFeriado(diaSiguiente(fecha));
}

/** El feriado al que da paso un día interferiado, para poder nombrarlo en pantalla. */
export function feriadoQueSigue(fecha: string): { fecha: string; nombre: string } | null {
  const siguiente = diaSiguiente(fecha);
  const nombre = nombreFeriado(siguiente);
  return nombre ? { fecha: siguiente, nombre } : null;
}

export function hayCalendarioPara(fecha: string): boolean {
  return ANIOS_CON_CALENDARIO.includes(Number(fecha.slice(0, 4)));
}

/** Todos los días interferiados del año, en orden. */
export function interferiadosDe(anio: number): { fecha: string; feriado: string; nombreFeriado: string }[] {
  const salida: { fecha: string; feriado: string; nombreFeriado: string }[] = [];
  const cur = new Date(anio, 0, 1);
  while (cur.getFullYear() === anio) {
    const iso = aIso(cur);
    if (esInterferiado(iso)) {
      const sig = feriadoQueSigue(iso)!;
      salida.push({ fecha: iso, feriado: sig.fecha, nombreFeriado: sig.nombre });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return salida;
}

/** Los interferiados que todavía no pasan, para ofrecerlos al funcionario. */
export function interferiadosDesde(hoy: string): { fecha: string; feriado: string; nombreFeriado: string }[] {
  const anio = Number(hoy.slice(0, 4));
  return [...interferiadosDe(anio), ...(ANIOS_CON_CALENDARIO.includes(anio + 1) ? interferiadosDe(anio + 1) : [])].filter(
    (i) => i.fecha >= hoy,
  );
}
