'use server';

import { revalidatePath } from 'next/cache';
import { actoDe } from '@/lib/acto';
import { fichaDe } from '@/lib/datos';
import { feriadoPorVencer, feriadoPostergable } from '@/lib/feriado';
import { firmaDe } from '@/lib/firmas';
import { jefaturaDe } from '@/lib/jefaturas';
import { etapaPostergacion, POSTERGACION_EN_LINEA, PROCESO_POSTERGACION } from '@/lib/postergacion';
import { crearSolicitud, responderFuncionario, solicitudDe } from '@/lib/postergaciones';
import { avisarPostergacion, avisarPostergacionPendiente } from '@/lib/webhook';
import { hoyChile } from '@/lib/fechas';
import { formatearRut } from '@/lib/rut';
import { requerirUsuario } from '@/lib/sesion';

export interface EstadoPaso {
  error?: string;
}

/**
 * El trámite se hace en papel: la plataforma no firma ni registra postergaciones. Va en las dos
 * acciones porque una pestaña abierta de antes todavía puede enviar el formulario.
 */
const EN_PAPEL =
  'La postergación ya no se tramita en la plataforma. Descarga el formulario en Word desde Mis días, fírmalo y envíalo por correo a administracion.personas@slepaconcagua.gob.cl.';

/** Redondea a medio día, que es la fracción mínima con que se registran los días. */
function mediosDias(valor: FormDataEntryValue | null): number {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 2) / 2 : 0;
}

/** Sección I: el funcionario solicita su feriado y firma. */
export async function solicitar(_: EstadoPaso, form: FormData): Promise<EstadoPaso> {
  if (!POSTERGACION_EN_LINEA) return { error: EN_PAPEL };

  const u = await requerirUsuario();
  if (u.rol !== 'funcionario' || !u.rut) return { error: 'Solo los funcionarios pueden solicitar la postergación.' };
  if (etapaPostergacion(hoyChile()) !== 'abierto') return { error: 'El proceso de postergación no está abierto.' };

  const firma = await firmaDe(u.id);
  if (!firma) return { error: 'Primero tienes que guardar tu firma en Mi firma.' };

  const ya = await solicitudDe(u.rut);
  if (ya && ['pendiente_jefatura', 'pendiente_funcionario', 'completa'].includes(ya.estado)) {
    return { error: 'Ya tienes una solicitud en curso para este año.' };
  }

  const ficha = await fichaDe(u.rut);
  const fl = ficha.dias?.feriadoLegal;
  if (!fl) return { error: 'Todavía no hay información de tu feriado legal.' };

  const postergable = feriadoPostergable(fl);
  if (postergable <= 0) return { error: 'No tienes días del año en curso que puedas postergar.' };

  const dias = mediosDias(form.get('dias'));
  if (dias <= 0) return { error: 'Indica cuántos días quieres solicitar.' };
  if (dias > postergable) {
    return { error: `Solo puedes postergar hasta ${postergable} días, que son los del año ${PROCESO_POSTERGACION.anioAPostergar}.` };
  }

  const inicio = String(form.get('desde') ?? '').trim();
  const fechaInicio = /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? inicio : null;
  if (fechaInicio && fechaInicio.slice(0, 4) !== String(PROCESO_POSTERGACION.anioAPostergar)) {
    return { error: `La fecha de inicio tiene que ser del año ${PROCESO_POSTERGACION.anioAPostergar}.` };
  }

  const jefatura = await jefaturaDe(u.rut);
  if (!jefatura) {
    return { error: 'No pude identificar a tu jefatura en la Dotación. Avísale a Gestión de Personas para que la asigne.' };
  }

  const d = ficha.dotacion;
  const creada = await crearSolicitud({
    rut: u.rut,
    jefaturaRut: jefatura.rut,
    ficha: {
      nombre: d?.nombre || ficha.dias?.nombre || u.nombre || '',
      rutTexto: d?.rutTexto || ficha.dias?.rutTexto || formatearRut(u.rut),
      cargo: d?.cargo ?? '',
      grado: d?.grado ?? '',
      estamento: d?.estamento ?? '',
      unidad: d?.area || ficha.dias?.area || '',
      jefaturaNombre: jefatura.nombre,
      postergableAlSolicitar: postergable,
      porVencerAlSolicitar: feriadoPorVencer(fl),
    },
    diasSolicitados: dias,
    fechaInicio,
    firma: await actoDe(d?.nombre || u.nombre || '', formatearRut(u.rut)),
  });
  await avisarPostergacionPendiente(creada.id);

  revalidatePath('/mis-dias/postergacion');
  revalidatePath('/mis-dias');
  return {};
}

/** Sección III: el funcionario acepta la postergación y declara cuántos días acumula, o desiste. */
export async function aceptar(_: EstadoPaso, form: FormData): Promise<EstadoPaso> {
  if (!POSTERGACION_EN_LINEA) return { error: EN_PAPEL };

  const u = await requerirUsuario();
  if (u.rol !== 'funcionario' || !u.rut) return { error: 'Solo los funcionarios pueden responder esta solicitud.' };

  const firma = await firmaDe(u.id);
  if (!firma) return { error: 'Primero tienes que guardar tu firma en Mi firma.' };

  const p = await solicitudDe(u.rut);
  if (!p || p.estado !== 'pendiente_funcionario') return { error: 'Esta solicitud ya fue respondida.' };

  const acepta = String(form.get('acepta') ?? '') === 'si';
  let dias: number | null = null;

  if (acepta) {
    const ficha = await fichaDe(u.rut);
    const fl = ficha.dias?.feriadoLegal;
    const postergable = fl ? feriadoPostergable(fl) : 0;
    dias = mediosDias(form.get('dias'));
    if (dias <= 0) return { error: 'Indica cuántos días quieres acumular.' };
    if (dias > postergable) {
      return {
        error: `Solo puedes acumular hasta ${postergable} días, que son los del año ${PROCESO_POSTERGACION.anioAPostergar}. Los días acumulados de años anteriores no se pueden postergar otra vez.`,
      };
    }
    if (dias > p.diasSolicitados) {
      return { error: `No puedes acumular más días de los que solicitaste (${p.diasSolicitados}).` };
    }
  }

  const d = (await fichaDe(u.rut)).dotacion;
  await responderFuncionario(p.id, acepta, dias, await actoDe(d?.nombre || u.nombre || '', formatearRut(u.rut)));
  await avisarPostergacion(p.id);

  revalidatePath('/mis-dias/postergacion');
  revalidatePath('/mis-dias');
  return {};
}
