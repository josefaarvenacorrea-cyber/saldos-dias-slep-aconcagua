import 'server-only';
import { neon } from '@neondatabase/serverless';

// En Vercel se usa Neon (Postgres). En el computador, sin DATABASE_URL, se usa PGlite
// (Postgres en un archivo local), solo para desarrollo y pruebas.

export type Paso = { texto: string; params?: unknown[] };
type Fila = Record<string, unknown>;
interface Motor {
  consulta(texto: string, params?: unknown[]): Promise<Fila[]>;
  transaccion(pasos: Paso[]): Promise<void>;
}

const ESQUEMA = `
create table if not exists config (
  clave text primary key,
  valor text not null
);
create table if not exists cargas (
  id serial primary key,
  tipo text not null check (tipo in ('dias', 'descansos', 'dotacion')),
  archivo text not null,
  subida_por text not null,
  subida_en timestamptz not null default now(),
  activa boolean not null default false,
  resumen jsonb not null default '{}'::jsonb,
  alertas jsonb not null default '[]'::jsonb
);
create unique index if not exists cargas_una_activa_por_tipo on cargas (tipo) where activa;
create table if not exists registros (
  carga_id integer not null references cargas(id) on delete cascade,
  rut text not null,
  datos jsonb not null,
  primary key (carga_id, rut)
);
create index if not exists registros_por_rut on registros (rut);
create table if not exists usuarios (
  id serial primary key,
  rut text unique,
  nombre text,
  email text unique,
  email_alt text,
  email_manual boolean not null default false,
  clave_hash text,
  debe_cambiar boolean not null default true,
  rol text not null default 'funcionario' check (rol in ('funcionario', 'admin')),
  intentos_fallidos integer not null default 0,
  bloqueado_hasta timestamptz,
  deshabilitado boolean not null default false,
  vigente boolean not null default true,
  version_sesion integer not null default 1,
  ultimo_ingreso timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists usuarios_por_email_alt on usuarios (email_alt);
create table if not exists auditoria (
  id bigserial primary key,
  en timestamptz not null default now(),
  actor text,
  accion text not null,
  detalle jsonb
);
`;

function urlBaseDeDatos(): string | undefined {
  const env = process.env;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  // La integración de Vercel puede agregar un prefijo (ej. MIPROYECTO_DATABASE_URL).
  const clave = Object.keys(env).find((k) => /_DATABASE_URL$/.test(k) && !/UNPOOLED/.test(k));
  return clave ? env[clave] : undefined;
}

const ESQUEMA_PROPIO = 'saldos_dias';

type Global = typeof globalThis & { __motorSaldos?: Promise<Motor> };

async function crearMotor(): Promise<Motor> {
  const url = urlBaseDeDatos();
  let motor: Motor;
  if (url) {
    const sql = neon(url);
    // La base de Neon puede estar compartida con otras plataformas: todas las tablas de esta
    // viven en su propio esquema para no mezclarse con tablas del mismo nombre.
    await sql.query(`create schema if not exists ${ESQUEMA_PROPIO}`);
    const fijarEsquema = () => sql.query(`set local search_path to ${ESQUEMA_PROPIO}`);
    motor = {
      consulta: async (t, p = []) => {
        const [, filas] = await sql.transaction([fijarEsquema(), sql.query(t, p)]);
        return filas as Fila[];
      },
      transaccion: async (pasos) => {
        await sql.transaction([fijarEsquema(), ...pasos.map((s) => sql.query(s.texto, s.params ?? []))]);
      },
    };
  } else {
    if (process.env.VERCEL) throw new Error('Falta conectar la base de datos (DATABASE_URL) en Vercel.');
    const paquete = '@electric-sql/pglite';
    const { PGlite } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ paquete)) as typeof import('@electric-sql/pglite');
    const carpeta = process.env.PGLITE_DIR ?? '.datos-locales/pglite';
    const { mkdirSync } = await import('node:fs');
    mkdirSync(carpeta, { recursive: true });
    const pg = new PGlite(carpeta);
    motor = {
      consulta: async (t, p = []) => (await pg.query<Fila>(t, p)).rows,
      transaccion: async (pasos) => {
        await pg.transaction(async (tx) => {
          for (const s of pasos) await tx.query(s.texto, s.params ?? []);
        });
      },
    };
  }
  for (const sentencia of ESQUEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await motor.consulta(sentencia);
  }
  return motor;
}

function motor(): Promise<Motor> {
  const g = globalThis as Global;
  g.__motorSaldos ??= crearMotor().catch((e) => {
    g.__motorSaldos = undefined;
    throw e;
  });
  return g.__motorSaldos;
}

export async function consulta<T = Fila>(texto: string, params: unknown[] = []): Promise<T[]> {
  return (await (await motor()).consulta(texto, params)) as T[];
}

export async function transaccion(pasos: Paso[]): Promise<void> {
  await (await motor()).transaccion(pasos);
}

export async function auditar(actor: string | null, accion: string, detalle?: Record<string, unknown>): Promise<void> {
  await consulta('insert into auditoria (actor, accion, detalle) values ($1, $2, $3::jsonb)', [actor, accion, JSON.stringify(detalle ?? {})]);
}
