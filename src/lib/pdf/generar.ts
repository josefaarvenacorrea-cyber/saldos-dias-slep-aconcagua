import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { firmaDe, firmaPorRut } from '../firmas.ts';
import { consulta } from '../db.ts';
import type { Permiso } from '../permisos.ts';
import type { Postergacion } from '../postergaciones.ts';
import { PermisoPdf } from './PermisoPdf.tsx';
import { PostergacionPdf } from './PostergacionPdf.tsx';

/**
 * Arma el PDF de cada formulario a partir de los datos ya congelados en la solicitud, así que el
 * documento sale siempre igual: la ficha del funcionario es la copia que se guardó al pedir, y las
 * firmas llevan la fecha y hora en que se hicieron.
 */

/** La firma guardada de una persona, buscada por su RUT. */
async function firmaDeRut(rut: string | null): Promise<string | null> {
  return firmaPorRut(rut);
}

export async function pdfDePermiso(p: Permiso): Promise<Buffer> {
  const [solicitud, jefatura] = await Promise.all([firmaDeRut(p.rut), firmaDeRut(p.jefaturaRut)]);
  return renderToBuffer(PermisoPdf({ p, firmas: { solicitud, jefatura } }));
}

export async function pdfDePostergacion(p: Postergacion): Promise<Buffer> {
  const [funcionario, jefatura] = await Promise.all([firmaDeRut(p.rut), firmaDeRut(p.jefaturaRut)]);
  return renderToBuffer(
    PostergacionPdf({
      p,
      firmas: { solicitud: funcionario, jefatura, aceptacion: p.firmaAceptacion ? funcionario : null },
    }),
  );
}

/** Nombre con que se archiva el documento, pensado para que ordene bien en la carpeta. */
export function nombreArchivo(nombre: string, codigo: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('_');
  return `${limpio || 'Funcionario'}_${codigo}.pdf`;
}

/** Correo institucional de una persona, para que el flujo sepa a quién escribirle. */
export async function correoDe(rut: string | null): Promise<string | null> {
  if (!rut) return null;
  const [fila] = await consulta<{ email: string | null; email_alt: string | null }>(
    'select email, email_alt from usuarios where rut = $1',
    [rut],
  );
  return fila?.email ?? fila?.email_alt ?? null;
}

export { firmaDe };
