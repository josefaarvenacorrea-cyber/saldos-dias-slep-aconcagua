import 'server-only';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Contraseñas con scrypt (incluido en Node). Formato guardado: s1$<sal>$<hash> en hexadecimal.
const N = 32768;
const R = 8;
const P = 1;
const LARGO = 32;

function scrypt(clave: string, sal: Buffer): Promise<Buffer> {
  const opciones: ScryptOptions = { N, r: R, p: P, maxmem: 64 * 1024 * 1024 };
  return new Promise((ok, mal) => scryptCb(clave.normalize('NFC'), sal, LARGO, opciones, (e, k) => (e ? mal(e) : ok(k))));
}

export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(clave, sal);
  return `s1$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function claveCoincide(clave: string, guardada: string): Promise<boolean> {
  const [version, salHex, hashHex] = guardada.split('$');
  if (version !== 's1' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtenido = await scrypt(clave, Buffer.from(salHex, 'hex'));
  return esperado.length === obtenido.length && timingSafeEqual(esperado, obtenido);
}

/** Comparación de textos en tiempo constante (para la clave inicial). */
export function textosIguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Reglas para la contraseña nueva. Devuelve el problema o null si está bien. */
export function problemaConClave(nueva: string, rut: string | null): string | null {
  if (nueva.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (nueva.length > 128) return 'La contraseña es demasiado larga.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva) || !/\d/.test(nueva)) return 'La contraseña debe tener letras y números.';
  if (rut && nueva.replace(/\D/g, '').includes(rut.slice(0, 6))) return 'La contraseña no puede contener tu RUT.';
  if (/^(.)\1+$/.test(nueva)) return 'La contraseña no puede ser un mismo carácter repetido.';
  return null;
}
