'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auditar, consulta } from '@/lib/db';
import { activarCarga, sincronizarUsuarios } from '@/lib/datos';
import { ADMIN_EMAIL, requerirAdmin } from '@/lib/sesion';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function idDe(form: FormData): number {
  const id = Number(form.get('id'));
  if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador inválido');
  return id;
}

async function funcionario(id: number) {
  const [u] = await consulta<{ id: number; rut: string; email: string | null; nombre: string | null }>(
    `select id, rut, email, nombre from usuarios where id = $1 and rol = 'funcionario'`,
    [id],
  );
  if (!u) throw new Error('Funcionario no encontrado');
  return u;
}

/** Vuelve la contraseña a la inicial (4 primeros dígitos del RUT) y obliga a cambiarla. */
export async function restablecerClave(form: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const u = await funcionario(idDe(form));
  await consulta(
    `update usuarios set clave_hash = null, debe_cambiar = true, intentos_fallidos = 0, bloqueado_hasta = null,
            version_sesion = version_sesion + 1, actualizado_en = now() where id = $1`,
    [u.id],
  );
  await auditar(admin.email, 'restablecer_clave', { funcionario: u.rut });
  redirect(`/admin/funcionarios/${u.id}?ok=clave`);
}

export async function desbloquear(form: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const u = await funcionario(idDe(form));
  await consulta('update usuarios set intentos_fallidos = 0, bloqueado_hasta = null where id = $1', [u.id]);
  await auditar(admin.email, 'desbloquear', { funcionario: u.rut });
  redirect(`/admin/funcionarios/${u.id}?ok=desbloqueo`);
}

export async function cambiarHabilitacion(form: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const u = await funcionario(idDe(form));
  const deshabilitar = form.get('accion') === 'deshabilitar';
  await consulta('update usuarios set deshabilitado = $2, version_sesion = version_sesion + 1, actualizado_en = now() where id = $1', [u.id, deshabilitar]);
  await auditar(admin.email, deshabilitar ? 'deshabilitar_cuenta' : 'habilitar_cuenta', { funcionario: u.rut });
  redirect(`/admin/funcionarios/${u.id}?ok=${deshabilitar ? 'deshabilitada' : 'habilitada'}`);
}

/** Cambia el correo de ingreso a mano. Queda fijo aunque se suba otra Dotación. Vacío = volver al de la Dotación. */
export async function cambiarCorreo(form: FormData): Promise<void> {
  const admin = await requerirAdmin();
  const u = await funcionario(idDe(form));
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!email) {
    await consulta('update usuarios set email_manual = false, actualizado_en = now() where id = $1', [u.id]);
    await sincronizarUsuarios();
    await auditar(admin.email, 'correo_desde_dotacion', { funcionario: u.rut });
    redirect(`/admin/funcionarios/${u.id}?ok=correo`);
  }
  if (!CORREO.test(email) || email.length > 200) redirect(`/admin/funcionarios/${u.id}?error=correo-invalido`);
  if (email === ADMIN_EMAIL) redirect(`/admin/funcionarios/${u.id}?error=correo-ocupado`);
  const [otro] = await consulta<{ id: number }>('select id from usuarios where (email = $1 or email_alt = $1) and id <> $2', [email, u.id]);
  if (otro) redirect(`/admin/funcionarios/${u.id}?error=correo-ocupado`);
  await consulta('update usuarios set email = $2, email_alt = null, email_manual = true, actualizado_en = now() where id = $1', [u.id, email]);
  await auditar(admin.email, 'cambiar_correo', { funcionario: u.rut });
  redirect(`/admin/funcionarios/${u.id}?ok=correo`);
}

export async function usarCarga(form: FormData): Promise<void> {
  const admin = await requerirAdmin();
  await activarCarga(idDe(form), admin.email ?? 'admin');
  revalidatePath('/admin', 'layout');
  redirect('/admin/cargas?ok=version');
}
