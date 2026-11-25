import { sumarDias } from './fechas.ts';

/**
 * Período en que se puede pedir postergar el feriado legal del año al año siguiente.
 * Los días acumulados de años anteriores no entran: esos se pierden si no se usan en el año.
 * Cambiar estas fechas cada año.
 */
export const PROCESO_POSTERGACION = {
  inicio: '2026-11-19',
  fin: '2026-12-05',
  /** Hasta cuándo se sigue mostrando el aviso (después del fin dice que el proceso terminó). */
  avisoHasta: '2026-12-11',
  anioAPostergar: 2026,
  anioDestino: 2027,
  anioAcumulado: 2025,
};

/**
 * Si el trámite de postergación se hace dentro de la plataforma o en papel.
 *
 * En `false`, como está hoy, la plataforma no tramita postergaciones: el formulario se descarga
 * en Word, se firma y se envía por correo, igual que antes. Nadie puede iniciar una solicitud
 * nueva ni firmar una que quedó a medias, y las que ya existen se siguen viendo, de solo lectura.
 *
 * Los permisos no dependen de esto: se siguen pidiendo, firmando y archivando en la plataforma.
 *
 * Para volver a abrir el trámite en línea basta poner `true`, sin cambiar nada más.
 */
export const POSTERGACION_EN_LINEA = false;

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

const FORMULARIO_PERMISOS = {
  archivo: '/formularios/formulario-solicitud-permisos.docx',
  titulo: 'Formulario de solicitud de permisos',
  descripcion: 'Feriado legal, días administrativos, descanso complementario, interferiado y otros permisos.',
  peso: '115 KB',
};

const FORMULARIO_POSTERGACION = {
  archivo: '/formularios/formulario-postergacion-feriado-legal.docx',
  titulo: 'Formulario de postergación de feriado legal',
  descripcion: `Para acumular días de feriado legal de ${PROCESO_POSTERGACION.anioAPostergar} para ${PROCESO_POSTERGACION.anioDestino}, según el artículo N°104 del estatuto administrativo.`,
  peso: '69 KB',
};

/**
 * Formularios que se llenan en papel. El de postergación aparece solo mientras ese trámite no se
 * haga dentro de la plataforma.
 */
export const FORMULARIOS = POSTERGACION_EN_LINEA
  ? [FORMULARIO_PERMISOS]
  : [FORMULARIO_PERMISOS, FORMULARIO_POSTERGACION];

/** El formulario en Word de la postergación, para enlazarlo desde el trámite mismo. */
export const WORD_POSTERGACION = FORMULARIO_POSTERGACION;
