/**
 * Emparejar el nombre de la jefatura escrito en la Dotación con la persona que le corresponde.
 *
 * En la Dotación la jefatura viene escrita a mano y a veces con el nombre incompleto
 * ("Alejandra Meza Veas" por "Alejandra de las Mercedes Meza Veas"), así que se acepta el nombre
 * incompleto mientras no quede duda. Si calza con más de una persona, o con ninguna, no se adivina:
 * se avisa para que la administración asigne la jefatura a mano.
 *
 * Esta pieza decide quién autoriza una postergación, así que vive aparte de la base de datos
 * para poder probarla sola.
 */

/** Palabras que no ayudan a distinguir a una persona de otra. */
const CONECTORES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA']);

/** "Ríos Soto, María José" → ["MARIA", "JOSE", "RIOS", "SOTO"] */
export function tokensNombre(nombre: string): string[] {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s,]/g, ' ');
  // "Apellido Apellido, Nombre" se escribe igual que "Nombre Apellido Apellido".
  const partes = limpio.split(',');
  const ordenado = partes.length === 2 ? `${partes[1]} ${partes[0]}` : limpio;
  return ordenado.split(/\s+/).filter((t) => t.length > 1 && !CONECTORES.has(t));
}

/** Verdadero si todos los tokens escritos en la Dotación están en el nombre completo de la persona. */
export function nombreCalza(buscados: string[], completos: string[]): boolean {
  if (!buscados.length) return false;
  const disponibles = [...completos];
  for (const t of buscados) {
    const i = disponibles.indexOf(t);
    if (i === -1) return false;
    disponibles.splice(i, 1);
  }
  return true;
}

export type MotivoSinJefatura = 'no_existe' | 'ambiguo' | 'si_mismo' | 'muy_corto';

export type Emparejamiento = { rut: string } | { motivo: MotivoSinJefatura };

/** Busca a la jefatura escrita entre las personas de la Dotación, aceptando nombres incompletos. */
export function resolverPorNombre(
  jefaturaNombre: string,
  rutFuncionario: string,
  personas: { rut: string; nombre: string }[],
): Emparejamiento {
  const buscados = tokensNombre(jefaturaNombre);
  // Con un solo token ("Alejandra") hay demasiado riesgo de confundir a dos personas.
  if (buscados.length < 2) return { motivo: 'muy_corto' };

  let candidatos = personas.filter((otra) => nombreCalza(buscados, tokensNombre(otra.nombre)));
  // Si varias calzan, se prefiere la que tiene exactamente el mismo nombre.
  if (candidatos.length > 1) {
    const exactas = candidatos.filter((o) => tokensNombre(o.nombre).length === buscados.length);
    if (exactas.length === 1) candidatos = exactas;
  }

  if (candidatos.length > 1) return { motivo: 'ambiguo' };
  if (!candidatos.length) return { motivo: 'no_existe' };
  if (candidatos[0].rut === rutFuncionario) return { motivo: 'si_mismo' };
  return { rut: candidatos[0].rut };
}

export const TEXTO_MOTIVO: Record<MotivoSinJefatura, string> = {
  no_existe: 'No hay nadie en la Dotación con ese nombre.',
  ambiguo: 'Hay más de una persona en la Dotación que calza con ese nombre.',
  si_mismo: 'El nombre apunta a la misma persona.',
  muy_corto: 'El nombre tiene una sola palabra y no basta para identificar a la persona.',
};
