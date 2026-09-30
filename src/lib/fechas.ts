import type { DiaUsado } from './tipos.ts';

// Feriados nacionales de Chile. Hay que agregar los del año siguiente cuando llegue la base de ese año.
export const FERIADOS: Record<string, string> = {
  '2026-01-01': 'Año Nuevo',
  '2026-04-03': 'Viernes Santo',
  '2026-04-04': 'Sábado Santo',
  '2026-05-01': 'Día Nacional del Trabajo',
  '2026-05-21': 'Día de las Glorias Navales',
  '2026-06-21': 'Día Nacional de los Pueblos Indígenas',
  '2026-06-29': 'San Pedro y San Pablo',
  '2026-07-16': 'Día de la Virgen del Carmen',
  '2026-08-15': 'Asunción de la Virgen',
  '2026-09-18': 'Independencia Nacional',
  '2026-09-19': 'Día de las Glorias del Ejército',
  '2026-10-12': 'Encuentro de Dos Mundos',
  '2026-10-31': 'Día de las Iglesias Evangélicas y Protestantes',
  '2026-11-01': 'Día de Todos los Santos',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Navidad',
};

const DIA_MS = 86_400_000;

/** Fecha (sin hora) en formato AAAA-MM-DD, usando UTC para que no se corra un día. */
export function isoDe(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function desdeIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function sumarDias(iso: string, dias: number): string {
  return isoDe(new Date(desdeIso(iso).getTime() + dias * DIA_MS));
}

export function esFeriado(iso: string): boolean {
  return iso in FERIADOS;
}

export function esFinDeSemana(iso: string): boolean {
  const d = desdeIso(iso).getUTCDay();
  return d === 0 || d === 6;
}

export function esDiaHabil(iso: string): boolean {
  return !esFinDeSemana(iso) && !esFeriado(iso);
}

/**
 * Reparte una cantidad de días en días hábiles, desde la fecha de inicio.
 * 0,5 → medio día en la fecha de inicio; 1,5 → un día completo y medio día al día hábil siguiente.
 */
export function repartirDiasHabiles(inicio: string, cantidad: number): DiaUsado[] {
  const reparto: DiaUsado[] = [];
  let fecha = inicio;
  let restante = cantidad;
  let vueltas = 0;
  while (restante > 1e-9 && vueltas++ < 500) {
    if (esDiaHabil(fecha)) {
      const fraccion = Math.min(1, restante);
      reparto.push({ fecha, fraccion });
      restante -= fraccion;
    }
    fecha = sumarDias(fecha, 1);
  }
  return reparto;
}

export function diasHabilesEntre(desde: string, hasta: string): number {
  let n = 0;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) if (esDiaHabil(f)) n++;
  return n;
}

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreDia(iso: string): string {
  return NOMBRE_DIA[desdeIso(iso).getUTCDay()];
}

/** "2026-03-05" → "05-03-2026" */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** "2026-03-05" → "jueves 5 de marzo de 2026" */
export function fechaLarga(iso: string): string {
  const d = desdeIso(iso);
  return `${nombreDia(iso)} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Fecha y hora de Chile continental, para mostrar cuándo se actualizó la información. */
export function fechaHoraChile(valor: Date | string): string {
  const d = new Date(valor);
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  return `${p('day')}-${p('month')}-${p('year')} a las ${p('hour')}:${p('minute')}`;
}

/** Hoy en Chile, como AAAA-MM-DD. */
export function hoyChile(): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return partes;
}
