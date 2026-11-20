import 'server-only';
import { auditar, consulta } from './db.ts';

/**
 * La firma que cada persona guarda una vez en su cuenta, dibujada o subida como imagen.
 * Nunca se estampa sola: se aplica solo cuando la persona dueña de la cuenta confirma la acción,
 * y de ese acto queda registro aparte, en la propia solicitud.
 */

/** Un PNG o JPG como data URL. El canvas de firma queda muy por debajo de este tamaño. */
const LARGO_MAXIMO = 400_000;
const FORMATO = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

export function problemaConFirma(imagen: string): string | null {
  if (!imagen) return 'No recibí ninguna firma.';
  if (!FORMATO.test(imagen)) return 'La firma debe ser una imagen PNG o JPG.';
  if (imagen.length > LARGO_MAXIMO) return 'La imagen es muy pesada. Usa una más liviana o dibuja tu firma.';
  return null;
}

export async function firmaDe(usuarioId: number): Promise<string | null> {
  const [fila] = await consulta<{ imagen: string }>('select imagen from firmas where usuario_id = $1', [usuarioId]);
  return fila?.imagen ?? null;
}

/** La firma de una persona buscada por su RUT, para estampar la de la jefatura en el documento. */
export async function firmaPorRut(rut: string | null): Promise<string | null> {
  if (!rut) return null;
  const [fila] = await consulta<{ imagen: string }>(
    'select f.imagen from firmas f join usuarios u on u.id = f.usuario_id where u.rut = $1',
    [rut],
  );
  return fila?.imagen ?? null;
}

export async function guardarFirma(usuarioId: number, actor: string, imagen: string): Promise<void> {
  await consulta(
    `insert into firmas (usuario_id, imagen) values ($1, $2)
     on conflict (usuario_id) do update set imagen = excluded.imagen, guardada_en = now()`,
    [usuarioId, imagen],
  );
  await auditar(actor, 'firma.guardada', { bytes: imagen.length });
}

export async function borrarFirma(usuarioId: number, actor: string): Promise<void> {
  await consulta('delete from firmas where usuario_id = $1', [usuarioId]);
  await auditar(actor, 'firma.borrada');
}
