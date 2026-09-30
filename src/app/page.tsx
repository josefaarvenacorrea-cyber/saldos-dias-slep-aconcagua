import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/sesion';

export default async function Inicio() {
  const u = await usuarioActual();
  if (!u) redirect('/ingresar');
  if (u.debe_cambiar) redirect('/cambiar-clave');
  redirect(u.rol === 'admin' ? '/admin' : '/mis-dias');
}
