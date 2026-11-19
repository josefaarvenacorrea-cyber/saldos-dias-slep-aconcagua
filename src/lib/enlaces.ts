import 'server-only';
import { funcionariosACargo } from './jefaturas.ts';

/**
 * Los enlaces de la barra para un funcionario. "Autorizaciones" aparece solo si tiene gente a
 * cargo, porque ser jefatura no es un rol de la cuenta: sale de la columna JEFATURA de la Dotación.
 */
export async function enlacesDe(rut: string | null) {
  const enlaces = [
    { href: '/mis-dias', texto: 'Mis días' },
    { href: '/mi-firma', texto: 'Mi firma' },
    { href: '/cambiar-clave', texto: 'Cambiar contraseña' },
  ];
  if (rut && (await funcionariosACargo(rut)).length) {
    enlaces.splice(1, 0, { href: '/autorizaciones', texto: 'Autorizaciones' });
  }
  return enlaces;
}
