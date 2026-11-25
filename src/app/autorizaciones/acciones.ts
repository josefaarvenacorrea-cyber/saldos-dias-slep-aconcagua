'use server';

import { revalidatePath } from 'next/cache';
import { actoDe } from '@/lib/acto';
import { fichaDe } from '@/lib/datos';
import { firmaDe } from '@/lib/firmas';
import { permisoPorId, responderPermiso } from '@/lib/permisos';
import { POSTERGACION_EN_LINEA } from '@/lib/postergacion';
import { porId, responderJefatura } from '@/lib/postergaciones';
import { avisarPermiso, avisarPostergacion, avisarPostergacionPropuesta } from '@/lib/webhook';
import { formatearRut } from '@/lib/rut';
import { requerirUsuario } from '@/lib/sesion';

export interface EstadoRespuesta {
  error?: string;
}

/** Sección II: la jefatura autoriza el feriado o lo deniega por buen servicio, y firma. */
export async function responder(_: EstadoRespuesta, form: FormData): Promise<EstadoRespuesta> {
  if (!POSTERGACION_EN_LINEA) {
    return {
      error:
        'La postergación de feriado legal ya no se tramita en la plataforma: ahora se firma el formulario en Word. Los permisos se siguen autorizando aquí.',
    };
  }

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
  // Si autorizó el feriado, el proceso cerró. Si lo denegó y propuso postergar, la solicitud vuelve
  // al funcionario para su firma de la sección III. Cada función avisa solo en su caso.
  await avisarPostergacion(p.id);
  await avisarPostergacionPropuesta(p.id);

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
