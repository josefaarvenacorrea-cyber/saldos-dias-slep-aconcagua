import 'server-only';
import { headers } from 'next/headers';
import type { ActoFirma } from './postergaciones.ts';

/**
 * Deja constancia de quién firmó, cuándo y desde qué dirección. Es lo que convierte la imagen de
 * la firma en algo verificable: la imagen es la formalidad, este registro es la prueba.
 */
export async function actoDe(nombre: string, rut: string): Promise<ActoFirma> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  return { nombre, rut, en: new Date().toISOString(), ip };
}
