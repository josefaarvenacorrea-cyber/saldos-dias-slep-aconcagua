'use server';

import { revalidatePath } from 'next/cache';
import { actoDe } from '@/lib/acto';
import { fichaDe } from '@/lib/datos';
import { firmaDe } from '@/lib/firmas';
import { permisoPorId, responderPermiso } from '@/lib/permisos';
import { porId, responderJefatura } from '@/lib/postergaciones';
import { avisarPermiso, avisarPostergacion } from '@/lib/webhook';
import { formatearRut } from '@/lib/rut';
import { requerirUsuario } from '@/lib/sesion';

export interface EstadoRespuesta {
  error?: string;
}

/** Sección II: la jefatura autoriza el feriado o lo deniega por buen servicio, y firma. */
export async function responder(_: EstadoRespuesta, form: FormData): Promise<EstadoRespuesta> {
  const u = await requerirUsuario();
  if (!u.rut) return { error: 'Tu cuenta no tiene RUT asociado.' };

  const firma = await firmaDe(u.id);
  if (!firma) return { error: 'Primero tienes que guardar tu firma en Mi firma.' };

  const id = Number(form.get('id'));
  const p = Number.isInteger(id) ? await porId(id) : null;
  if (!p) return { error: 'No encontré esa solicitud.' };
  // Solo puede responder la jefatura a la que se le asignó la solicitud.
  if (p.jefaturaRut !== u.rut) return { error: 'Esta solicitud no está dirigida a ti.' };
  if (p.estado !== 'pendiente_jefatura') return { error: 'Esta solicitud ya fue respondida.' };

  const autoriza = String(form.get('autoriza') ?? '') === 'si';
  const d = (await fichaDe(u.rut)).dotacion;
  await responderJefatura(p.id, autoriza, await actoDe(d?.nombre || u.nombre || '', formatearRut(u.rut)));
  // Si autorizó el feriado, el proceso cerró y se avisa. Si lo denegó, la solicitud vuelve al
  // funcionario y todavía no hay documento que avisar: avisarPostergacion lo distingue solo.
  await avisarPostergacion(p.id);

  revalidatePath('/autorizaciones');
  revalidatePath('/mis-dias/postergacion');
  return {};
}

/** La jefatura autoriza o rechaza una solicitud de permiso, y firma. */
export async function responderSolicitudPermiso(_: EstadoRespuesta, form: FormData): Promise<EstadoRespuesta> {
  const u = await requerirUsuario();
  if (!u.rut) return { error: 'Tu cuenta no tiene RUT asociado.' };

  const firma = await firmaDe(u.id);
  if (!firma) return { error: 'Primero tienes que guardar tu firma en Mi firma.' };

  const id = Number(form.get('id'));
  const p = Number.isInteger(id) ? await permisoPorId(id) : null;
  if (!p) return { error: 'No encontré esa solicitud.' };
  if (p.jefaturaRut !== u.rut) return { error: 'Esta solicitud no está dirigida a ti.' };
  if (p.estado !== 'pendiente_jefatura') return { error: 'Esta solicitud ya fue respondida.' };

  const autoriza = String(form.get('autoriza') ?? '') === 'si';
  const d = (await fichaDe(u.rut)).dotacion;
  await responderPermiso(p.id, autoriza, await actoDe(d?.nombre || u.nombre || '', formatearRut(u.rut)));
  await avisarPermiso(p.id);

  revalidatePath('/autorizaciones');
  revalidatePath('/mis-dias/permisos');
  return {};
}
