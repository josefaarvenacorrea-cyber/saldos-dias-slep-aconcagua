import { sumarDias } from './fechas.ts';

/**
 * Período en que se puede pedir postergar el feriado legal del año al año siguiente.
 * Los días acumulados de años anteriores no entran: esos se pierden si no se usan en el año.
 * Cambiar estas fechas cada año.
 */
export const PROCESO_POSTERGACION = {
  inicio: '2026-11-23',
  fin: '2026-12-05',
  /** Hasta cuándo se sigue mostrando el aviso (después del fin dice que el proceso terminó). */
  avisoHasta: '2026-12-11',
  anioAPostergar: 2026,
  anioDestino: 2027,
  anioAcumulado: 2025,
};

/** Cuántos días antes del inicio se empieza a avisar. */
const AVISO_PREVIO_DIAS = 21;

export type EtapaPostergacion = 'proximo' | 'abierto' | 'terminado';

/** 'proximo' antes de que abra, 'abierto' mientras dura, 'terminado' hasta avisoHasta y null fuera de esas fechas. */
export function etapaPostergacion(hoy: string): EtapaPostergacion | null {
  const { inicio, fin, avisoHasta } = PROCESO_POSTERGACION;
  if (hoy > avisoHasta) return null;
  if (hoy > fin) return 'terminado';
  if (hoy >= inicio) return 'abierto';
  return hoy >= sumarDias(inicio, -AVISO_PREVIO_DIAS) ? 'proximo' : null;
}

export const FORMULARIOS = [
  {
    archivo: '/formularios/formulario-postergacion-feriado-legal.docx',
    titulo: 'Formulario de postergación de feriado legal',
    descripcion: 'Para pedir postergar los días de feriado legal del año al año siguiente.',
    peso: '69 KB',
  },
  {
    archivo: '/formularios/formulario-solicitud-permisos.docx',
    titulo: 'Formulario de solicitud de permisos',
    descripcion: 'Feriado legal, días administrativos, descanso compensatorio, interferiado y otros permisos.',
    peso: '115 KB',
  },
];
