import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { consulta } from './db.ts';

const COOKIE = 'sds_sesion';
const DURACION_S = 8 * 60 * 60; // 8 horas

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'administracion.personas@slepaconcagua.gob.cl').trim().toLowerCase();

export interface Usuario {
  id: number;
  rut: string | null;
  nombre: string | null;
  email: string | null;
  rol: 'funcionario' | 'admin';
  debe_cambiar: boolean;
  version_sesion: number;
}

// El secreto para firmar sesiones se genera una sola vez y se guarda en la base de datos.
let secretoEnMemoria: string | null = null;
async function secreto(): Promise<string> {
  if (secretoEnMemoria) return secretoEnMemoria;
  await consulta(`insert into config (clave, valor) values ('secreto_sesion', $1) on conflict (clave) do nothing`, [randomBytes(32).toString('hex')]);
  const [fila] = await consulta<{ valor: string }>(`select valor from config where clave = 'secreto_sesion'`);
  secretoEnMemoria = fila.valor;
  return secretoEnMemoria;
}

async function firmar(datos: Record<string, number>): Promise<string> {
  const cuerpo = Buffer.from(JSON.stringify(datos)).toString('base64url');
  const firma = createHmac('sha256', await secreto()).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

async function leerToken(token: string): Promise<{ uid: number; v: number; exp: number } | null> {
  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;
  const esperada = createHmac('sha256', await secreto()).update(cuerpo).digest();
  const recibida = Buffer.from(firma, 'base64url');
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    if (typeof d.uid !== 'number' || typeof d.v !== 'number' || typeof d.exp !== 'number') return null;
    if (d.exp * 1000 < Date.now()) return null;
    return d;
  } catch {
    return null;
  }
}

/** Crea la cookie de sesión (solo desde acciones de servidor o rutas). */
export async function iniciarSesion(u: { id: number; version_sesion: number }): Promise<void> {
  const token = await firmar({ uid: u.id, v: u.version_sesion, exp: Math.floor(Date.now() / 1000) + DURACION_S });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_S,
  });
}

export async function cerrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function usuarioActual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const datos = await leerToken(token);
  if (!datos) return null;
  const [u] = await consulta<Usuario & { deshabilitado: boolean; vigente: boolean }>(
    'select id, rut, nombre, email, rol, debe_cambiar, version_sesion, deshabilitado, vigente from usuarios where id = $1',
    [datos.uid],
  );
  if (!u || u.version_sesion !== datos.v || u.deshabilitado || (u.rol === 'funcionario' && !u.vigente)) return null;
  return { id: u.id, rut: u.rut, nombre: u.nombre, email: u.email, rol: u.rol, debe_cambiar: u.debe_cambiar, version_sesion: u.version_sesion };
}

export async function requerirUsuario(opciones?: { permitirCambioPendiente?: boolean }): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect('/ingresar');
  if (u.debe_cambiar && !opciones?.permitirCambioPendiente) redirect('/cambiar-clave');
  return u;
}

export async function requerirAdmin(): Promise<Usuario> {
  const u = await requerirUsuario();
  if (u.rol !== 'admin') redirect('/mis-dias');
  return u;
}

/** Crea la cuenta de administración si no existe. Su contraseña inicial viene de ADMIN_INITIAL_PASSWORD. */
export async function asegurarAdmin(): Promise<void> {
  await consulta(
    `insert into usuarios (email, nombre, rol, debe_cambiar, vigente)
     values ($1, 'Administración de Personas', 'admin', true, true)
     on conflict (email) do update set rol = 'admin'`,
    [ADMIN_EMAIL],
  );
}
