import 'server-only';
import { auditar, consulta, transaccion } from './db.ts';
import { ADMIN_EMAIL } from './sesion.ts';
import type { Alerta, FichaDescansos, FichaDias, FichaDotacion, ResultadoLectura, TipoArchivo } from './tipos.ts';

export const NOMBRE_ARCHIVO: Record<TipoArchivo, string> = {
  dias: 'Base de Saldos de Días',
  descansos: 'Base de Saldos de Descansos Complementarios',
  dotacion: 'Dotación',
};

const CARGAS_GUARDADAS_POR_TIPO = 40;

export interface Carga {
  id: number;
  tipo: TipoArchivo;
  archivo: string;
  subida_por: string;
  subida_en: string | Date;
  activa: boolean;
  resumen: Record<string, number | string>;
  alertas?: Alerta[];
  n_alertas?: number;
}

/** Guarda una carga, la deja activa (reemplaza la anterior del mismo tipo) y sincroniza las cuentas. */
export async function guardarCarga(tipo: TipoArchivo, archivo: string, actor: string, lectura: ResultadoLectura<unknown>): Promise<number> {
  const [{ id }] = await consulta<{ id: number }>(`select nextval(pg_get_serial_sequence('cargas', 'id'))::int as id`);
  await transaccion([
    {
      texto: `insert into cargas (id, tipo, archivo, subida_por, resumen, alertas) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      params: [id, tipo, archivo.slice(0, 200), actor, JSON.stringify(lectura.resumen), JSON.stringify(lectura.alertas)],
    },
    {
      texto: `insert into registros (carga_id, rut, datos) select $1, e.key, e.value from jsonb_each($2::jsonb) as e`,
      params: [id, JSON.stringify(lectura.personas)],
    },
    { texto: `update cargas set activa = false where tipo = $1 and activa`, params: [tipo] },
    { texto: `update cargas set activa = true where id = $1`, params: [id] },
  ]);
  await consulta(
    `delete from cargas where tipo = $1 and not activa and id not in (select id from cargas where tipo = $1 order by id desc limit ${CARGAS_GUARDADAS_POR_TIPO})`,
    [tipo],
  );
  await auditar(actor, 'carga', { tipo, archivo, carga: id, resumen: lectura.resumen });
  await sincronizarUsuarios();
  return id;
}

/** Vuelve a una carga anterior (por si se subió un archivo equivocado). */
export async function activarCarga(id: number, actor: string): Promise<void> {
  const [c] = await consulta<{ tipo: TipoArchivo }>('select tipo from cargas where id = $1', [id]);
  if (!c) throw new Error('Carga no encontrada');
  await transaccion([
    { texto: 'update cargas set activa = false where tipo = $1 and activa', params: [c.tipo] },
    { texto: 'update cargas set activa = true where id = $1', params: [id] },
  ]);
  await auditar(actor, 'cambio_de_carga_activa', { tipo: c.tipo, carga: id });
  await sincronizarUsuarios();
}

/**
 * Crea o actualiza una cuenta por cada persona con saldos (días o descansos).
 * El correo sale de la Dotación, salvo que la administración lo haya cambiado a mano.
 * Quien ya no aparece en los datos queda "no vigente" y no puede ingresar.
 */
export async function sincronizarUsuarios(): Promise<void> {
  const filas = await consulta<{ tipo: TipoArchivo; rut: string; nombre: string | null; ci: string | null; cp: string | null }>(
    `select c.tipo, r.rut, r.datos->>'nombre' as nombre, r.datos->>'correoInstitucional' as ci, r.datos->>'correoPersonal' as cp
     from cargas c join registros r on r.carga_id = c.id where c.activa`,
  );
  const conDatos = new Map<string, string>();
  const correos = new Map<string, { principal: string | null; alterno: string | null }>();
  for (const f of filas) {
    if (f.tipo === 'dotacion') {
      const principal = f.cp || f.ci;
      correos.set(f.rut, { principal: principal ?? null, alterno: f.cp && f.ci ? f.ci : null });
    } else if (!conDatos.has(f.rut) || f.tipo === 'dias') {
      conDatos.set(f.rut, f.nombre ?? '');
    }
  }
  const existentes = await consulta<{ rut: string | null; email: string | null; email_alt: string | null; email_manual: boolean; rol: string }>(
    'select rut, email, email_alt, email_manual, rol from usuarios',
  );
  // Correos que no se pueden reasignar: los de la administración y los puestos a mano.
  const ocupados = new Map<string, string>();
  for (const u of existentes) {
    if (u.rol === 'admin' || u.email_manual) {
      if (u.email) ocupados.set(u.email, u.rut ?? 'admin');
      if (u.email_alt) ocupados.set(u.email_alt, u.rut ?? 'admin');
    }
  }
  ocupados.set(ADMIN_EMAIL, 'admin');
  const lista = [...conDatos.entries()].map(([rut, nombre]) => {
    const c = correos.get(rut);
    const libre = (e: string | null) => {
      if (!e) return null;
      const dueño = ocupados.get(e);
      if (dueño && dueño !== rut) return null;
      ocupados.set(e, rut);
      return e;
    };
    return { rut, nombre, email: libre(c?.principal ?? null), email_alt: libre(c?.alterno ?? null) };
  });
  await transaccion([
    { texto: `update usuarios set email = null, email_alt = null where rol = 'funcionario' and not email_manual` },
    {
      texto: `insert into usuarios (rut, nombre, email, email_alt, vigente)
              select x.rut, x.nombre, x.email, x.email_alt, true from jsonb_to_recordset($1::jsonb) as x(rut text, nombre text, email text, email_alt text)
              on conflict (rut) do update set
                nombre = excluded.nombre,
                vigente = true,
                email = case when usuarios.email_manual then usuarios.email else excluded.email end,
                email_alt = case when usuarios.email_manual then usuarios.email_alt else excluded.email_alt end,
                actualizado_en = now()`,
      params: [JSON.stringify(lista)],
    },
    {
      texto: `update usuarios set vigente = false, actualizado_en = now()
              where rol = 'funcionario' and vigente and rut not in (select x.rut from jsonb_to_recordset($1::jsonb) as x(rut text))`,
      params: [JSON.stringify(lista.map(({ rut }) => ({ rut })))],
    },
  ]);
}

export async function cargasActivas(): Promise<Carga[]> {
  return consulta<Carga>(
    `select id, tipo, archivo, subida_por, subida_en, activa, resumen, jsonb_array_length(alertas) as n_alertas from cargas where activa order by tipo`,
  );
}

export async function historialCargas(): Promise<Carga[]> {
  return consulta<Carga>(
    `select id, tipo, archivo, subida_por, subida_en, activa, resumen, jsonb_array_length(alertas) as n_alertas from cargas order by id desc limit 60`,
  );
}

export async function alertasActivas(): Promise<Alerta[]> {
  const filas = await consulta<{ alertas: Alerta[] }>('select alertas from cargas where activa');
  return filas.flatMap((f) => f.alertas ?? []);
}

export interface Ficha {
  dias: FichaDias | null;
  descansos: FichaDescansos | null;
  dotacion: FichaDotacion | null;
  actualizado: Date | null;
}

/** Todo lo que ve una persona: sus registros en las cargas activas. */
export async function fichaDe(rut: string): Promise<Ficha> {
  const [filas, activas] = await Promise.all([
    consulta<{ tipo: TipoArchivo; datos: unknown }>(
      'select c.tipo, r.datos from cargas c join registros r on r.carga_id = c.id where c.activa and r.rut = $1',
      [rut],
    ),
    consulta<{ tipo: TipoArchivo; subida_en: string | Date }>('select tipo, subida_en from cargas where activa'),
  ]);
  const ficha: Ficha = { dias: null, descansos: null, dotacion: null, actualizado: null };
  for (const f of filas) {
    if (f.tipo === 'dias') ficha.dias = f.datos as FichaDias;
    if (f.tipo === 'descansos') ficha.descansos = f.datos as FichaDescansos;
    if (f.tipo === 'dotacion') ficha.dotacion = f.datos as FichaDotacion;
  }
  for (const a of activas) {
    if (a.tipo === 'dotacion') continue;
    const d = new Date(a.subida_en);
    if (!ficha.actualizado || d > ficha.actualizado) ficha.actualizado = d;
  }
  return ficha;
}

export interface FilaFuncionario {
  id: number;
  rut: string;
  nombre: string | null;
  email: string | null;
  email_alt: string | null;
  email_manual: boolean;
  debe_cambiar: boolean;
  ultimo_ingreso: string | Date | null;
  bloqueado_hasta: string | Date | null;
  deshabilitado: boolean;
  vigente: boolean;
  area: string | null;
  adm: string | null;
  fl: string | null;
  dc: string | null;
}

export async function listaFuncionarios(): Promise<FilaFuncionario[]> {
  return consulta<FilaFuncionario>(`
    select u.id, u.rut, u.nombre, u.email, u.email_alt, u.email_manual, u.debe_cambiar, u.ultimo_ingreso, u.bloqueado_hasta,
           u.deshabilitado, u.vigente,
           d.datos->>'area' as area,
           d.datos->'administrativos'->>'saldo' as adm,
           d.datos->'feriadoLegal'->>'saldo' as fl,
           s.datos->>'saldo' as dc
    from usuarios u
    left join (select r.rut, r.datos from registros r join cargas c on c.id = r.carga_id and c.activa and c.tipo = 'dias') d on d.rut = u.rut
    left join (select r.rut, r.datos from registros r join cargas c on c.id = r.carga_id and c.activa and c.tipo = 'descansos') s on s.rut = u.rut
    where u.rol = 'funcionario'
    order by u.vigente desc, u.nombre`);
}

/** Alertas que cruzan archivos: personas con saldos que no pueden ingresar. */
export async function alertasDeCuentas(): Promise<Alerta[]> {
  const filas = await consulta<{ rut: string; nombre: string | null; email: string | null }>(
    `select rut, nombre, email from usuarios where rol = 'funcionario' and vigente and email is null order by nombre`,
  );
  return filas.map((f) => ({
    nivel: 'alta' as const,
    archivo: 'dotacion' as const,
    hoja: 'Cuentas',
    fila: null,
    rut: f.rut,
    nombre: f.nombre ?? '',
    alerta: 'Sin correo: no puede ingresar',
    detalle: 'No está en la Dotación o no tiene correo ahí. Puedes agregarlo desde Funcionarios.',
  }));
}

export async function auditoriaReciente(limite = 200) {
  return consulta<{ id: number; en: string | Date; actor: string | null; accion: string; detalle: Record<string, unknown> | null }>(
    'select id, en, actor, accion, detalle from auditoria order by id desc limit $1',
    [limite],
  );
}
