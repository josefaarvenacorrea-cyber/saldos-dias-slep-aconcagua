/**
 * Reglas de cada tipo de permiso del "Formulario Solicitud de Permisos".
 *
 * - Feriado Legal: solo días completos (1, 2, 3...).
 * - Con goce de remuneraciones: se fracciona en medio día, así que da 0,5 / 1 / 1,5 / 2...
 * - Descanso Complementario: por horas, dentro de un solo día. Así lo llama el estatuto
 *   administrativo y así lo escribe la columna Tipo de la planilla.
 * - Interferiado y Otros Permisos: quedan registrados, pero sin tope automático porque todavía no
 *   están definidas sus reglas de cuánto corresponde ni contra qué saldo descuentan.
 *
 * Vive aparte de la base de datos para poder probarlo solo.
 */

import { esDiaHabil, esInterferiado, habilesDesde, hayCalendarioPara, nombreFeriado } from './feriadosChile.ts';

export type TipoPermiso = 'feriado' | 'goce' | 'compensatorio' | 'interferiado' | 'otros';

export type Jornada = 'completa' | 'am' | 'pm';

export interface DiaPedido {
  /** Fecha en formato YYYY-MM-DD. */
  fecha: string;
  jornada: Jornada;
}

export const TIPOS: { valor: TipoPermiso; nombre: string; regla: string }[] = [
  { valor: 'feriado', nombre: 'Feriado Legal', regla: 'Solo días completos' },
  { valor: 'goce', nombre: 'Con goce de remuneraciones', regla: 'Día completo o medio día' },
  { valor: 'compensatorio', nombre: 'Descanso Complementario', regla: 'Por horas, dentro de un día' },
  { valor: 'interferiado', nombre: 'Interferiado', regla: 'Horas por recuperar' },
  { valor: 'otros', nombre: 'Otros Permisos', regla: 'Requiere certificado' },
];

export const CAUSALES_OTROS = ['Nacimiento', 'Fallecimiento', 'Matrimonio', 'Deportivo', 'Gremial', 'Otros'] as const;
export type CausalOtros = (typeof CAUSALES_OTROS)[number];

export function nombreTipo(t: TipoPermiso): string {
  return TIPOS.find((x) => x.valor === t)?.nombre ?? t;
}

/** Los tipos que se piden por horas dentro de un solo día. */
export function esPorHoras(t: TipoPermiso): boolean {
  return t === 'compensatorio';
}

/** Los tipos que descuentan de un saldo conocido. Los demás se registran sin tope. */
export function descuentaSaldo(t: TipoPermiso): boolean {
  return t === 'feriado' || t === 'goce' || t === 'compensatorio';
}

/**
 * Día que no se descuenta del saldo: sábado, domingo o feriado. Si alguien pide un permiso que
 * cruza un feriado, ese feriado no le cuesta días.
 */
export function esNoHabil(fecha: string): boolean {
  return !esDiaHabil(fecha);
}

/** Por qué un día no se descuenta, para decirlo en pantalla. */
export function motivoNoHabil(fecha: string): string | null {
  if (esDiaHabil(fecha)) return null;
  return nombreFeriado(fecha) ?? 'fin de semana';
}

/** Los días del rango, con la jornada que corresponda según el tipo. */
export function diasDelRango(desde: string, hasta: string, tipo: TipoPermiso, previas: Record<string, Jornada> = {}): DiaPedido[] {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const fin = new Date(a2, m2 - 1, d2);
  const salida: DiaPedido[] = [];
  const cur = new Date(a1, m1 - 1, d1);
  // Tope de seguridad: ningún permiso de este formulario cubre más de dos meses.
  for (let i = 0; cur <= fin && i < 70; i++) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    // El feriado legal y el interferiado se toman por jornada completa.
    const soloCompleta = tipo === 'feriado' || tipo === 'interferiado';
    salida.push({ fecha: iso, jornada: soloCompleta ? 'completa' : (previas[iso] ?? 'completa') });
    cur.setDate(cur.getDate() + 1);
  }
  return salida;
}

/** Total de días que se descuentan: los fines de semana no cuentan y el medio día vale 0,5. */
export function totalDias(dias: DiaPedido[]): number {
  const t = dias.reduce((acc, d) => {
    if (esNoHabil(d.fecha)) return acc;
    return acc + (d.jornada === 'completa' ? 1 : 0.5);
  }, 0);
  return Math.round(t * 2) / 2;
}

/** Minutos entre dos horas "HH:MM" del mismo día. */
export function totalMinutos(desde: string, hasta: string): number {
  const m = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };
  return m(hasta) - m(desde);
}

/** "7:30" a partir de minutos. */
export function horasTexto(minutos: number): string {
  const signo = minutos < 0 ? '-' : '';
  const x = Math.abs(minutos);
  return `${signo}${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
}

/**
 * Las horas del interferiado hay que devolverlas, y el acuerdo tiene que decir expresamente en qué
 * días se van a recuperar y con qué distribución horaria. Esto arma ese calendario.
 */
export interface DiaRecuperacion {
  fecha: string;
  horas: number;
}

export interface Recuperacion {
  /** Horas que se devuelven, que son las que se dejó de trabajar ese día. */
  horas: number;
  /** Cuántas horas extra se hacen cada día. */
  horasPorDia: number;
  /** Desde cuándo se empieza a devolver. */
  desde: string;
  dias: DiaRecuperacion[];
}

/** Reparte las horas a devolver en días hábiles seguidos, saltando fines de semana y feriados. */
export function planRecuperacion(desde: string, horas: number, horasPorDia: number): DiaRecuperacion[] {
  if (!(horas > 0) || !(horasPorDia > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return [];
  const cuantos = Math.ceil(horas / horasPorDia);
  if (cuantos > 60) return [];
  const fechas = habilesDesde(desde, cuantos);
  let resta = horas;
  return fechas.map((fecha) => {
    const h = Math.min(horasPorDia, resta);
    resta = Math.round((resta - h) * 100) / 100;
    return { fecha, horas: Math.round(h * 100) / 100 };
  });
}

export function totalRecuperado(dias: DiaRecuperacion[]): number {
  return Math.round(dias.reduce((t, d) => t + d.horas, 0) * 100) / 100;
}

export interface Solicitud {
  tipo: TipoPermiso;
  dias: DiaPedido[];
  horaDesde: string;
  horaHasta: string;
  /** Nombre del archivo del certificado, cuando el tipo lo exige. */
  certificado: string | null;
  /** Calendario de devolución, solo para el interferiado. */
  recuperacion?: Recuperacion | null;
}

export interface Saldos {
  /** Días disponibles de feriado legal. */
  feriado: number;
  /** Días disponibles con goce de remuneraciones. */
  goce: number;
  /** Minutos disponibles de descanso complementario. */
  compensatorioMin: number;
}

export interface Revision {
  ok: boolean;
  /** Problema que impide enviar la solicitud. */
  error: string | null;
  /** Días que se descuentan, para los tipos por día. */
  dias: number;
  /** Minutos que se descuentan, para los tipos por hora. */
  minutos: number;
}

/**
 * Revisa una solicitud contra las reglas del tipo y el saldo disponible.
 * Es la misma función que usa la pantalla y el servidor al firmar, para que no puedan discrepar.
 */
export function revisar(s: Solicitud, saldos: Saldos): Revision {
  const vacio = { dias: 0, minutos: 0 };

  if (esPorHoras(s.tipo)) {
    const minutos = totalMinutos(s.horaDesde, s.horaHasta);
    if (!s.dias.length) return { ok: false, error: 'Indica la fecha del permiso.', ...vacio };
    if (minutos <= 0) return { ok: false, error: 'La hora de término tiene que ser posterior a la de inicio.', ...vacio, minutos };
    if (minutos > saldos.compensatorioMin) {
      return {
        ok: false,
        error: `Pides ${horasTexto(minutos)} hrs y tu saldo complementario es de ${horasTexto(saldos.compensatorioMin)} hrs.`,
        dias: 0,
        minutos,
      };
    }
    return { ok: true, error: null, dias: 0, minutos };
  }

  const dias = totalDias(s.dias);
  if (!s.dias.length) return { ok: false, error: 'Indica las fechas del permiso.', ...vacio };
  if (dias <= 0) return { ok: false, error: 'El rango que elegiste no tiene días hábiles.', ...vacio };

  if (s.tipo === 'feriado' && dias % 1 !== 0) {
    return { ok: false, error: 'El feriado legal solo admite días completos.', dias, minutos: 0 };
  }

  if (s.tipo === 'interferiado') {
    const habiles = s.dias.filter((d) => !esNoHabil(d.fecha));
    const sinCalendario = habiles.find((d) => !hayCalendarioPara(d.fecha));
    if (sinCalendario) {
      return { ok: false, error: 'Todavía no tengo cargados los feriados de ese año.', dias, minutos: 0 };
    }
    const fuera = habiles.find((d) => !esInterferiado(d.fecha));
    if (fuera) {
      return {
        ok: false,
        error: 'El permiso por interferiado solo se puede pedir en un día hábil que esté justo antes de un feriado.',
        dias,
        minutos: 0,
      };
    }
    if (habiles.length !== 1) {
      return { ok: false, error: 'El interferiado se pide de a un día.', dias, minutos: 0 };
    }

    // Sin plan de devolución no hay permiso: el acuerdo tiene que decir cuándo se recuperan las horas.
    const r = s.recuperacion;
    if (!r || !(r.horas > 0)) {
      return { ok: false, error: 'Indica cuántas horas vas a devolver.', dias, minutos: 0 };
    }
    if (!(r.horasPorDia > 0)) {
      return { ok: false, error: 'Indica cuántas horas extra vas a hacer cada día.', dias, minutos: 0 };
    }
    if (r.horasPorDia > r.horas) {
      return { ok: false, error: 'Las horas por día no pueden superar el total que vas a devolver.', dias, minutos: 0 };
    }
    if (!r.dias.length) {
      return { ok: false, error: 'Indica desde cuándo vas a devolver las horas.', dias, minutos: 0 };
    }
    if (totalRecuperado(r.dias) !== Math.round(r.horas * 100) / 100) {
      return { ok: false, error: 'El calendario de devolución no suma las horas que tienes que devolver.', dias, minutos: 0 };
    }
  }

  if (s.tipo === 'otros' && !s.certificado) {
    return { ok: false, error: 'Tienes que adjuntar el certificado correspondiente.', dias, minutos: 0 };
  }

  if (descuentaSaldo(s.tipo)) {
    const saldo = s.tipo === 'feriado' ? saldos.feriado : saldos.goce;
    if (dias > saldo) {
      return { ok: false, error: `Pides ${dias} días y tu saldo disponible es de ${saldo}.`, dias, minutos: 0 };
    }
  }

  return { ok: true, error: null, dias, minutos: 0 };
}

/**
 * El formulario en papel tiene una sola casilla de tipo de jornada, así que no puede expresar
 * una solicitud con jornadas distintas en días distintos (por ejemplo 1,5 días). Cuando pasa eso
 * el documento no marca ninguna casilla y detalla día por día.
 */
export function jornadaUnica(dias: DiaPedido[]): Jornada | null {
  const habiles = dias.filter((d) => !esNoHabil(d.fecha));
  if (!habiles.length) return null;
  const primera = habiles[0].jornada;
  return habiles.every((d) => d.jornada === primera) ? primera : null;
}
