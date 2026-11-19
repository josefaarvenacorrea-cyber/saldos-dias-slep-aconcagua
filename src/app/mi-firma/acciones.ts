'use server';

import { revalidatePath } from 'next/cache';
import { borrarFirma, guardarFirma, problemaConFirma } from '@/lib/firmas';
import { requerirUsuario } from '@/lib/sesion';

export interface EstadoFirma {
  error?: string;
  guardada?: boolean;
}

export async function guardarMiFirma(_: EstadoFirma, form: FormData): Promise<EstadoFirma> {
  const u = await requerirUsuario();
  const imagen = String(form.get('imagen') ?? '');
  const problema = problemaConFirma(imagen);
  if (problema) return { error: problema };
  await guardarFirma(u.id, u.email ?? String(u.id), imagen);
  revalidatePath('/mi-firma');
  return { guardada: true };
}

export async function borrarMiFirma(): Promise<void> {
  const u = await requerirUsuario();
  await borrarFirma(u.id, u.email ?? String(u.id));
  revalidatePath('/mi-firma');
}
