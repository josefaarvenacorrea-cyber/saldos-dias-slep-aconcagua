'use server';

import { redirect } from 'next/navigation';
import { auditar, consulta } from '@/lib/db';
import { claveCoincide, cifrarClave, problemaConClave, textosIguales } from '@/lib/claves';
import { claveInicialDe } from '@/lib/rut';
import { ADMIN_EMAIL, asegurarAdmin, cerrarSesion, iniciarSesion, usuarioActual } from '@/lib/sesion';

export interface EstadoFormulario {
  error?: string;
  email?: string;
}

const INTENTOS_MAXIMOS = 5;
const BLOQUEO_MINUTOS = 15;
const MENSAJE_GENERICO = 'El correo o la contraseña no son correctos.';
const MENSAJE_BLOQUEO = `Por seguridad, tu cuenta quedó bloqueada ${BLOQUEO_MINUTOS} minutos por varios intentos fallidos. Intenta más tarde o escribe a ${ADMIN_EMAIL}.`;

const pausa = () => new Promise((ok) => setTimeout(ok, 350 + Math.random() * 300));

interface FilaUsuario {
  id: number;
  rut: string | null;
  email: string;
  rol: 'funcionario' | 'admin';
  clave_hash: string | null;
  debe_cambiar: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | Date | null;
  deshabilitado: boolean;
  vigente: boolean;
  version_sesion: number;
}

export async function ingresar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const clave = String(form.get('clave') ?? '').slice(0, 200);
  if (!email || !clave) return { error: 'Escribe tu correo y tu contraseña.', email };
  if (email === ADMIN_EMAIL) await asegurarAdmin();

  const [u] = await consulta<FilaUsuario>(
    `select id, rut, email, rol, clave_hash, debe_cambiar, intentos_fallidos, bloqueado_hasta, deshabilitado, vigente, version_sesion
     from usuarios where email = $1 or email_alt = $1 order by (email = $1) desc limit 1`,
    [email],
  );
  if (!u || u.deshabilitado || (u.rol === 'funcionario' && !u.vigente)) {
    await pausa();
    await auditar(email, 'ingreso_fallido', { motivo: u ? 'cuenta_inactiva' : 'correo_desconocido' });
    return { error: MENSAJE_GENERICO, email };
  }
  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta).getTime() > Date.now()) {
    return { error: MENSAJE_BLOQUEO, email };
  }

  let correcta = false;
  if (u.clave_hash) {
    correcta = await claveCoincide(clave, u.clave_hash);
  } else if (u.rol === 'funcionario' && u.rut) {
    correcta = textosIguales(clave, claveInicialDe(u.rut));
  } else if (u.rol === 'admin') {
    const inicial = process.env.ADMIN_INITIAL_PASSWORD ?? '';
    correcta = inicial.length >= 8 && textosIguales(clave, inicial);
  }

  if (!correcta) {
    const intentos = u.intentos_fallidos + 1;
    const bloquear = intentos >= INTENTOS_MAXIMOS;
    await consulta('update usuarios set intentos_fallidos = $2, bloqueado_hasta = $3 where id = $1', [
      u.id,
      bloquear ? 0 : intentos,
      bloquear ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000).toISOString() : null,
    ]);
    await auditar(email, bloquear ? 'bloqueo_por_intentos' : 'ingreso_fallido', { motivo: 'clave' });
    await pausa();
    return { error: bloquear ? MENSAJE_BLOQUEO : MENSAJE_GENERICO, email };
  }

  await consulta('update usuarios set intentos_fallidos = 0, bloqueado_hasta = null, ultimo_ingreso = now() where id = $1', [u.id]);
  await auditar(u.email, 'ingreso');
  await iniciarSesion(u);
  redirect(u.debe_cambiar ? '/cambiar-clave' : u.rol === 'admin' ? '/admin' : '/mis-dias');
}

export async function cambiarClave(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const u = await usuarioActual();
  if (!u) redirect('/ingresar');
  const actual = String(form.get('actual') ?? '');
  const nueva = String(form.get('nueva') ?? '');
  const confirmar = String(form.get('confirmar') ?? '');

  const [fila] = await consulta<{ clave_hash: string | null }>('select clave_hash from usuarios where id = $1', [u.id]);
  if (!u.debe_cambiar) {
    const ok = fila?.clave_hash ? await claveCoincide(actual, fila.clave_hash) : false;
    if (!ok) return { error: 'Tu contraseña actual no es correcta.' };
  }
  if (nueva !== confirmar) return { error: 'Las dos contraseñas nuevas no coinciden.' };
  const problema = problemaConClave(nueva, u.rut);
  if (problema) return { error: problema };
  if (u.rol === 'admin' && process.env.ADMIN_INITIAL_PASSWORD && nueva === process.env.ADMIN_INITIAL_PASSWORD) {
    return { error: 'La contraseña nueva debe ser distinta de la inicial.' };
  }
  if (fila?.clave_hash && (await claveCoincide(nueva, fila.clave_hash))) {
    return { error: 'La contraseña nueva debe ser distinta de la actual.' };
  }

  const hash = await cifrarClave(nueva);
  const [act] = await consulta<{ id: number; version_sesion: number }>(
    `update usuarios set clave_hash = $2, debe_cambiar = false, intentos_fallidos = 0, bloqueado_hasta = null,
            version_sesion = version_sesion + 1, actualizado_en = now()
     where id = $1 returning id, version_sesion`,
    [u.id, hash],
  );
  await auditar(u.email, 'cambio_de_clave');
  await iniciarSesion(act);
  redirect(u.rol === 'admin' ? '/admin?clave=ok' : '/mis-dias?clave=ok');
}

export async function salir(): Promise<void> {
  const u = await usuarioActual();
  await cerrarSesion();
  if (u) await auditar(u.email, 'salida');
  redirect('/ingresar');
}
