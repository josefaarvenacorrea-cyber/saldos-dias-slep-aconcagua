/**
 * El texto de los correos que salen cuando se emite un documento, y la forma del aviso que se le
 * manda al flujo de Power Automate.
 *
 * Mis Días no envía correos por su cuenta: eso exigiría credenciales SMTP del tenant de Microsoft
 * 365 o verificar el dominio institucional en un servicio externo, y no hay ninguna de las dos.
 * En vez de eso avisa a un flujo de Power Automate por webhook, y el flujo manda el correo con la
 * cuenta de Microsoft de quien lo creó. Es el mismo camino que ya usa la plataforma de
 * Regularización de Marcaje.
 *
 * Los campos van planos a propósito. El flujo lo arma a mano quien administra, en la interfaz de
 * Power Automate, así que un campo plano se arrastra directo a su casilla; una lista obligaría a
 * escribir expresiones para indexarla, que es mucho más difícil de armar ahí.
 *
 * Vive aparte de la base de datos para poder probarlo solo.
 */

import { nombreTipo, type TipoPermiso } from './reglasPermisos.ts';
import { nombreMes, type CargoMes } from './integracion.ts';

/** Lo que el flujo necesita para una sola acción de "Enviar un correo (V2)". */
export interface CorreoPlano {
  para: string;
  /** Separadas por punto y coma, que es como las toma Outlook. */
  copia: string;
  asunto: string;
  cuerpoHtml: string;
  adjuntoNombre: string;
  adjuntoContenidoBase64: string;
}

export const COPIA_ADMINISTRACION = 'administracion.personas@slepaconcagua.gob.cl';

/** Fecha en el formato que se usa en la plataforma y en los formularios. */
export function fechaTexto(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

function copiaDe(jefaturaCorreo: string | null): string {
  return [jefaturaCorreo, COPIA_ADMINISTRACION].filter(Boolean).join(';');
}

/** "0,5 día", "1 día", "1,5 días": en singular cuando corresponde y con coma decimal. */
export function diasTexto(dias: number): string {
  const texto = String(dias).replace('.', ',');
  return `${texto} ${dias === 1 ? 'día' : 'días'}`;
}

function cierre(codigo: string): string {
  return `
      <p>El formulario firmado va adjunto. Quedó archivado y registrado, no hay que enviarlo a
      ninguna parte.</p>
      <p>Puedes verificarlo en Mis Días con el código <strong>${codigo}</strong>.</p>`;
}

/**
 * Cada evento de la tramitación manda su propio aviso. Los de "tienes algo pendiente" van sin PDF
 * y con el enlace para entrar a firmar, porque lo que hay que hacer es firmar, no guardar un papel.
 */
export type Evento =
  | 'permiso.solicitado'
  | 'permiso.respondido'
  | 'postergacion.solicitada'
  | 'postergacion.propuesta'
  | 'postergacion.cerrada';

/** Los avisos de cierre son los únicos que llevan el PDF y se archivan en el SharePoint. */
export function esCierre(evento: Evento): boolean {
  return evento === 'permiso.respondido' || evento === 'postergacion.cerrada';
}

function aFirmar(url: string, que: string): string {
  return `<p><a href="${url}">Entra a Mis Días para ${que}</a>.</p>`;
}

export interface DatosPendiente {
  codigo: string;
  /** A quién se dirige el correo, para saludarlo por su nombre. */
  destinatarioNombre: string;
  solicitanteNombre: string;
  jefaturaNombre: string;
  enlace: string;
}

/** Aviso a la jefatura: tiene un permiso esperando su firma. */
export function correoPermisoPendiente(
  d: DatosPendiente & {
    tipo: TipoPermiso;
    desde: string | null;
    hasta: string | null;
    totalDias: number;
    horaDesde: string | null;
    horaHasta: string | null;
    detalle: string | null;
  },
): { asunto: string; cuerpoHtml: string } {
  const cuando =
    d.horaDesde && d.horaHasta
      ? `${fechaTexto(d.desde)}, de ${d.horaDesde} a ${d.horaHasta}`
      : d.desde === d.hasta
        ? fechaTexto(d.desde)
        : `del ${fechaTexto(d.desde)} al ${fechaTexto(d.hasta)}`;
  const cuanto = d.horaDesde && d.horaHasta ? '' : `<li><strong>Días:</strong> ${diasTexto(d.totalDias)}</li>`;
  return {
    asunto: `Permiso pendiente de tu firma: ${d.solicitanteNombre} · ${nombreTipo(d.tipo)}`,
    cuerpoHtml: `
      <p>Hola ${d.jefaturaNombre}:</p>
      <p><strong>${d.solicitanteNombre}</strong> solicitó un permiso y lo firmó. Queda pendiente tu
      autorización.</p>
      <ul>
        <li><strong>Tipo:</strong> ${nombreTipo(d.tipo)}</li>
        <li><strong>Cuándo:</strong> ${cuando}</li>
        ${cuanto}
        ${d.detalle ? `<li><strong>Detalle:</strong> ${d.detalle}</li>` : ''}
      </ul>
      ${aFirmar(d.enlace, 'autorizarlo o rechazarlo y firmar')}`,
  };
}

/** Aviso a la jefatura: tiene una postergación esperando su firma. */
export function correoPostergacionPendiente(
  d: DatosPendiente & { diasSolicitados: number; fechaInicio: string | null },
): { asunto: string; cuerpoHtml: string } {
  return {
    asunto: `Feriado legal pendiente de tu firma: ${d.solicitanteNombre}`,
    cuerpoHtml: `
      <p>Hola ${d.jefaturaNombre}:</p>
      <p><strong>${d.solicitanteNombre}</strong> solicitó su feriado legal y firmó la sección I del
      formulario. Queda pendiente tu respuesta.</p>
      <ul>
        <li><strong>Días solicitados:</strong> ${diasTexto(d.diasSolicitados)}</li>
        <li><strong>A partir del:</strong> ${fechaTexto(d.fechaInicio)}</li>
      </ul>
      <p>Si no puedes concederlo por buen servicio, en la sección II propones la postergación y la
      solicitud vuelve a ${d.solicitanteNombre} para que acepte y declare cuántos días acumula.</p>
      ${aFirmar(d.enlace, 'responder y firmar')}`,
  };
}

/** Aviso al funcionario: la jefatura propuso postergar y falta su firma de la sección III. */
export function correoPostergacionPropuesta(
  d: DatosPendiente & { diasSolicitados: number; fechaInicio: string | null; postergable: number | null },
): { asunto: string; cuerpoHtml: string } {
  return {
    asunto: `Tu feriado legal necesita tu firma para cerrar · ${d.codigo}`,
    cuerpoHtml: `
      <p>Hola ${d.destinatarioNombre}:</p>
      <p>${d.jefaturaNombre} respondió tu solicitud de feriado legal del
      ${fechaTexto(d.fechaInicio)}: no puede concederlo por buen servicio y propone
      <strong>postergar los días</strong> para el año siguiente.</p>
      <p>Falta tu firma en la sección III, donde declaras cuántos días acumulas. Mientras no firmes,
      la tramitación queda abierta.</p>
      ${d.postergable !== null ? `<p>Puedes acumular hasta ${diasTexto(d.postergable)}.</p>` : ''}
      ${aFirmar(d.enlace, 'aceptar y firmar, o desistir')}`,
  };
}

export interface DatosCorreoPermiso {
  codigo: string;
  tipo: TipoPermiso;
  nombre: string;
  jefaturaNombre: string;
  autorizado: boolean;
  desde: string | null;
  hasta: string | null;
  totalDias: number;
  horaDesde: string | null;
  horaHasta: string | null;
  /** Solo en el interferiado, que es el único que deja horas por devolver. */
  recuperacion: { horas: number; dias: number; desde: string | null; hasta: string | null } | null;
}

export function asuntoPermiso(d: DatosCorreoPermiso): string {
  const estado = d.autorizado ? 'Permiso autorizado' : 'Permiso no autorizado';
  return `${estado}: ${nombreTipo(d.tipo)} · ${d.codigo}`;
}

export function cuerpoPermiso(d: DatosCorreoPermiso): string {
  // El interferiado no descuenta saldo, así que decir "1 día" ahí haría pensar que sí cuesta uno.
  const cuenta = d.autorizado && d.tipo !== 'interferiado' ? `, ${diasTexto(d.totalDias)}` : '';
  const cuando =
    d.horaDesde && d.horaHasta
      ? `<p>El <strong>${fechaTexto(d.desde)}</strong>, de ${d.horaDesde} a ${d.horaHasta}.</p>`
      : d.desde === d.hasta
        ? `<p>El <strong>${fechaTexto(d.desde)}</strong>${cuenta}.</p>`
        : `<p>Desde el <strong>${fechaTexto(d.desde)}</strong> hasta el <strong>${fechaTexto(d.hasta)}</strong>${cuenta}.</p>`;

  if (!d.autorizado) {
    return `
      <p>Hola ${d.nombre}:</p>
      <p>Tu solicitud de <strong>${nombreTipo(d.tipo)}</strong> <strong>no fue autorizada</strong>
      por ${d.jefaturaNombre}.</p>
      ${cuando}
      <p>Los días no se descontaron de tu saldo. El formulario con la respuesta va adjunto.</p>
      <p>Si tienes dudas sobre el motivo, conversa con tu jefatura directa.</p>`;
  }

  const devolucion = d.recuperacion
    ? `
      <p>Este permiso <strong>no descuenta saldo</strong>, pero las horas hay que devolverlas.
      Según lo que declaraste, son ${String(d.recuperacion.horas).replace('.', ',')} horas repartidas
      en ${d.recuperacion.dias} ${d.recuperacion.dias === 1 ? 'día' : 'días'}, entre el
      ${fechaTexto(d.recuperacion.desde)} y el ${fechaTexto(d.recuperacion.hasta)}. El detalle de
      cada día está en el formulario adjunto.</p>`
    : '';

  return `
      <p>Hola ${d.nombre}:</p>
      <p>Tu solicitud de <strong>${nombreTipo(d.tipo)}</strong> quedó <strong>autorizada</strong>
      por ${d.jefaturaNombre}.</p>
      ${cuando}
      ${devolucion}
      ${cierre(d.codigo)}`;
}

export interface DatosCorreoPostergacion {
  codigo: string;
  nombre: string;
  jefaturaNombre: string;
  estadoTexto: string;
  acepto: boolean;
  anio: number;
  anioDeUso: number;
  diasAcumular: number | null;
  fechaInicio: string | null;
}

export function asuntoPostergacion(d: DatosCorreoPostergacion): string {
  return `Postergación de feriado legal · ${d.codigo}`;
}

export function cuerpoPostergacion(d: DatosCorreoPostergacion): string {
  const acumula =
    d.acepto && d.diasAcumular
      ? `<p>Acumulas <strong>${diasTexto(d.diasAcumular)}</strong> de tu feriado legal ${d.anio}
         para usarlos en ${d.anioDeUso}.</p>`
      : '';
  const pedido = d.fechaInicio
    ? `<p>Tu solicitud era a partir del ${fechaTexto(d.fechaInicio)} (${nombreMes(Number(d.fechaInicio.slice(5, 7)))}).</p>`
    : '';
  // La postergación no queda oficial con las firmas: falta la resolución exenta, que se tramita
  // fuera de la plataforma. Decirlo acá evita que alguien crea que el trámite terminó.
  const rex = d.acepto
    ? `<p>Con esto la <strong>solicitud</strong> queda completa. Para que la postergación quede
       oficial falta la resolución exenta, que no se tramita en esta plataforma: la hace Gestión de
       Personas con este formulario como respaldo.</p>`
    : '';
  // El párrafo de la resolución exenta va al final, después del cierre: si fuera antes, quedaría
  // "falta la REX" seguido de "no hay que enviarlo a ninguna parte", que se leen contradictorios.
  return `
      <p>Hola ${d.nombre}:</p>
      <p>Tu solicitud de feriado legal quedó resuelta: <strong>${d.estadoTexto}</strong>.</p>
      ${pedido}
      ${acumula}
      ${cierre(d.codigo)}
      ${rex}`;
}

/** Arma el correo completo, listo para arrastrar campo por campo en Power Automate. */
export function correoPlano(
  destino: string | null,
  jefaturaCorreo: string | null,
  asunto: string,
  cuerpoHtml: string,
  adjuntoNombre: string,
  adjuntoContenidoBase64: string,
): CorreoPlano | null {
  // Sin correo del funcionario no hay a quién escribirle: el flujo no debe mandar nada a medias.
  if (!destino) return null;
  return { para: destino, copia: copiaDe(jefaturaCorreo), asunto, cuerpoHtml, adjuntoNombre, adjuntoContenidoBase64 };
}

/** Una fila de la hoja Movimientos, con los nombres de columna de la planilla. */
export function filaMovimiento(
  cargo: CargoMes,
  comun: { rutDv: string; nombre: string; tipo: string; desde: string | null; hasta: string | null; codigo: string },
  horas: number | null,
) {
  return {
    'RUT-DV': comun.rutDv,
    'NOMBRE COMPLETO': comun.nombre,
    Tipo: comun.tipo,
    Mes: cargo.mes,
    MesNombre: cargo.mesNombre,
    Días: horas === null ? cargo.dias : null,
    Horas: horas,
    'Fecha inicio': comun.desde,
    'Fecha término': comun.hasta,
    Código: comun.codigo,
    Origen: 'Plataforma',
    'N° documento': comun.codigo,
  };
}
