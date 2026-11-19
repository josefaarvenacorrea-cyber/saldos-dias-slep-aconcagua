import 'server-only';
import { consulta } from './db.ts';
import { resolverPorNombre, type MotivoSinJefatura } from './nombres.ts';

export interface PersonaDotacion {
  rut: string;
  nombre: string;
  jefaturaNombre: string;
}

/** Todas las personas de la Dotación activa, con el nombre de su jefatura tal como está escrito. */
export async function personasDotacion(): Promise<PersonaDotacion[]> {
  const filas = await consulta<{ rut: string; nombre: string | null; jefatura: string | null }>(
    `select r.rut, r.datos->>'nombre' as nombre, r.datos->>'jefatura' as jefatura
       from registros r join cargas c on c.id = r.carga_id
      where c.activa and c.tipo = 'dotacion'`,
  );
  return filas.map((f) => ({ rut: f.rut, nombre: f.nombre ?? '', jefaturaNombre: (f.jefatura ?? '').trim() }));
}

export interface MapaJefaturas {
  /** RUT del funcionario → RUT de su jefatura. Solo las que se pudieron resolver. */
  jefaturaDe: Map<string, string>;
  /** RUT del funcionario → jefatura escrita que no se pudo resolver, con el motivo. */
  sinResolver: Map<string, { nombre: string; motivo: MotivoSinJefatura }>;
  /** Nombre tal como viene en la Dotación, por RUT. */
  nombreDe: Map<string, string>;
}

/**
 * Resuelve de una vez las jefaturas de toda la Dotación. La asignación manual que haya hecho la
 * administración (usuarios.jefatura_rut) siempre manda por sobre el emparejamiento por nombre.
 */
export async function mapaJefaturas(): Promise<MapaJefaturas> {
  const [personas, manuales] = await Promise.all([
    personasDotacion(),
    consulta<{ rut: string; jefatura_rut: string }>(
      'select rut, jefatura_rut from usuarios where rut is not null and jefatura_rut is not null',
    ),
  ]);

  const nombreDe = new Map(personas.map((p) => [p.rut, p.nombre]));
  const manual = new Map(manuales.map((m) => [m.rut, m.jefatura_rut]));
  const jefaturaDe = new Map<string, string>();
  const sinResolver: MapaJefaturas['sinResolver'] = new Map();

  for (const p of personas) {
    const asignada = manual.get(p.rut);
    if (asignada && asignada !== p.rut) {
      jefaturaDe.set(p.rut, asignada);
      continue;
    }
    if (!p.jefaturaNombre) continue;
    const r = resolverPorNombre(p.jefaturaNombre, p.rut, personas);
    if ('rut' in r) jefaturaDe.set(p.rut, r.rut);
    else sinResolver.set(p.rut, { nombre: p.jefaturaNombre, motivo: r.motivo });
  }

  return { jefaturaDe, sinResolver, nombreDe };
}

/** La jefatura de una persona, o null si no se pudo resolver. */
export async function jefaturaDe(rut: string): Promise<{ rut: string; nombre: string } | null> {
  const m = await mapaJefaturas();
  const jefe = m.jefaturaDe.get(rut);
  return jefe ? { rut: jefe, nombre: m.nombreDe.get(jefe) ?? '' } : null;
}

/** RUT de las personas que dependen de esta jefatura. */
export async function funcionariosACargo(rutJefatura: string): Promise<string[]> {
  const m = await mapaJefaturas();
  const salida: string[] = [];
  for (const [rut, jefe] of m.jefaturaDe) if (jefe === rutJefatura) salida.push(rut);
  return salida;
}
