import 'server-only';
import { auditar, consulta } from './db.ts';
import { fichaDe } from './datos.ts';
import type { ActoFirma } from './postergaciones.ts';
import type { CausalOtros, DiaPedido, Saldos, TipoPermiso } from './reglasPermisos.ts';

/**
 * Solicitudes de permiso del "Formulario Solicitud de Permisos": el funcionario pide y firma,
 * la jefatura autoriza o rechaza y firma, y queda emitido el formulario con las dos firmas.
 */

export type EstadoPermiso = 'pendiente_jefatura' | 'autorizado' | 'rechazado';

/** Copia de los datos de la persona al momento de pedir, para que el documento no cambie después. */
export interface FichaPermiso {
  nombre: string;
  rutTexto: string;
  cargo: string;
  grado: string;
  estamento: string;
  unidad: string;
  jefaturaNombre: string;
}

export interface Permiso {
  id: number;
  codigo: string;
  rut: string;
  jefaturaRut: string | null;
  ficha: FichaPermiso;
  tipo: TipoPermiso;
  causal: CausalOtros | null;
  detalle: string | null;
  certificado: string | null;
  dias: DiaPedido[];
  totalDias: number;
  horaDesde: string | null;
  horaHasta: string | null;
  totalMinutos: number;
  estado: EstadoPermiso;
  firmaSolicitud: ActoFirma | null;
  firmaJefatura: ActoFirma | null;
  creadaEn: Date;
  actualizadaEn: Date;
}

type Fila = {
  id: number;
  codigo: string;
  rut: string;
  jefatura_rut: string | null;
  ficha: FichaPermiso;
  tipo: TipoPermiso;
  causal: CausalOtros | null;
  detalle: string | null;
  certificado: string | null;
  dias: DiaPedido[];
  total_dias: string | number;
  hora_desde: string | null;
  hora_hasta: string | null;
  total_minutos: number;
  estado: EstadoPermiso;
  firma_solicitud: ActoFirma | null;
  firma_jefatura: ActoFirma | null;
  creada_en: string | Date;
  actualizada_en: string | Date;
};

const COLUMNAS = `id, codigo, rut, jefatura_rut, ficha, tipo, causal, detalle, certificado, dias,
  total_dias, hora_desde, hora_hasta, total_minutos, estado, firma_solicitud, firma_jefatura,
  creada_en, actualizada_en`;

function desdeFila(f: Fila): Permiso {
  return {
    id: f.id,
    codigo: f.codigo,
    rut: f.rut,
    jefaturaRut: f.jefatura_rut,
    ficha: f.ficha ?? ({} as FichaPermiso),
    tipo: f.tipo,
    causal: f.causal,
    detalle: f.detalle,
    certificado: f.certificado,
    dias: Array.isArray(f.dias) ? f.dias : [],
    totalDias: Number(f.total_dias),
    horaDesde: f.hora_desde,
    horaHasta: f.hora_hasta,
    totalMinutos: Number(f.total_minutos),
    estado: f.estado,
    firmaSolicitud: f.firma_solicitud,
    firmaJefatura: f.firma_jefatura,
    creadaEn: new Date(f.creada_en),
    actualizadaEn: new Date(f.actualizada_en),
  };
}

function nuevoCodigo(): string {
  return `MD-PM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Saldo que de verdad le queda a la persona.
 *
 * El saldo del Excel vale al momento en que se subió la planilla. Todo permiso pedido en la
 * plataforma después de esa carga todavía no está reflejado ahí, así que hay que descontarlo:
 * si no, alguien podría pedir dos veces los mismos días mientras no se sube la planilla nueva.
 * Se descuenta lo autorizado y también lo que está esperando a la jefatura.
 */
export async function saldosDisponibles(rut: string): Promise<{ saldos: Saldos; descontado: boolean }> {
  const ficha = await fichaDe(rut);
  const base: Saldos = {
    feriado: ficha.dias?.feriadoLegal.saldo ?? 0,
    goce: ficha.dias?.administrativos.saldo ?? 0,
    // El saldo de descanso complementario viene en horas y acá se trabaja en minutos.
    compensatorioMin: Math.round((ficha.descansos?.saldo ?? 0) * 60),
  };

  // Cada saldo sale de su propia planilla, así que cada uno se compara con la fecha de su carga.
  const cargas = await consulta<{ tipo: string; subida_en: string | Date }>(
    "select tipo, subida_en from cargas where activa and tipo in ('dias', 'descansos')",
  );
  const fechaDe = new Map(cargas.map((c) => [c.tipo, c.subida_en]));

  const usos = await consulta<{ tipo: TipoPermiso; dias: string; minutos: string; creada_en: string | Date }>(
    `select tipo, total_dias as dias, total_minutos as minutos, creada_en
       from permisos
      where rut = $1 and estado in ('pendiente_jefatura', 'autorizado')`,
    [rut],
  );

  let descontado = false;
  for (const u of usos) {
    const origen = u.tipo === 'compensatorio' ? 'descansos' : 'dias';
    const subida = fechaDe.get(origen);
    // Sin carga activa no hay saldo contra el cual descontar, y si el permiso es anterior a la
    // planilla, esa planilla ya lo refleja.
    if (!subida || new Date(u.creada_en) <= new Date(subida)) continue;

    const d = Number(u.dias);
    const m = Number(u.minutos);
    if (d <= 0 && m <= 0) continue;
    descontado = true;
    if (u.tipo === 'feriado') base.feriado = Math.max(0, Math.round((base.feriado - d) * 2) / 2);
    if (u.tipo === 'goce') base.goce = Math.max(0, Math.round((base.goce - d) * 2) / 2);
    if (u.tipo === 'compensatorio') base.compensatorioMin = Math.max(0, base.compensatorioMin - m);
  }

  return { saldos: base, descontado };
}

export async function permisosDe(rut: string): Promise<Permiso[]> {
  const filas = await consulta<Fila>(`select ${COLUMNAS} from permisos where rut = $1 order by creada_en desc limit 100`, [rut]);
  return filas.map(desdeFila);
}

export async function permisoPorCodigo(codigo: string): Promise<Permiso | null> {
  const filas = await consulta<Fila>(`select ${COLUMNAS} from permisos where codigo = $1`, [codigo.trim().toUpperCase()]);
  return filas.length ? desdeFila(filas[0]) : null;
}

export async function permisoPorId(id: number): Promise<Permiso | null> {
  const filas = await consulta<Fila>(`select ${COLUMNAS} from permisos where id = $1`, [id]);
  return filas.length ? desdeFila(filas[0]) : null;
}

export async function permisosPendientesDe(rutJefatura: string): Promise<Permiso[]> {
  const filas = await consulta<Fila>(
    `select ${COLUMNAS} from permisos where jefatura_rut = $1 and estado = 'pendiente_jefatura' order by creada_en`,
    [rutJefatura],
  );
  return filas.map(desdeFila);
}

export async function todosLosPermisos(desde?: string): Promise<Permiso[]> {
  const filas = desde
    ? await consulta<Fila>(`select ${COLUMNAS} from permisos where creada_en >= $1 order by creada_en desc`, [desde])
    : await consulta<Fila>(`select ${COLUMNAS} from permisos order by creada_en desc limit 500`);
  return filas.map(desdeFila);
}

export async function crearPermiso(datos: {
  rut: string;
  jefaturaRut: string | null;
  ficha: FichaPermiso;
  tipo: TipoPermiso;
  causal: CausalOtros | null;
  detalle: string | null;
  certificado: string | null;
  dias: DiaPedido[];
  totalDias: number;
  horaDesde: string | null;
  horaHasta: string | null;
  totalMinutos: number;
  firma: ActoFirma;
}): Promise<Permiso> {
  for (let intento = 0; intento < 5; intento++) {
    try {
      const filas = await consulta<Fila>(
        `insert into permisos
           (codigo, rut, jefatura_rut, ficha, tipo, causal, detalle, certificado, dias, total_dias,
            hora_desde, hora_hasta, total_minutos, estado, firma_solicitud)
         values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13,
                 'pendiente_jefatura', $14::jsonb)
         returning ${COLUMNAS}`,
        [
          nuevoCodigo(),
          datos.rut,
          datos.jefaturaRut,
          JSON.stringify(datos.ficha),
          datos.tipo,
          datos.causal,
          datos.detalle,
          datos.certificado,
          JSON.stringify(datos.dias),
          datos.totalDias,
          datos.horaDesde,
          datos.horaHasta,
          datos.totalMinutos,
          JSON.stringify(datos.firma),
        ],
      );
      const p = desdeFila(filas[0]);
      await auditar(datos.rut, 'permiso.solicitud', { codigo: p.codigo, tipo: p.tipo, dias: p.totalDias });
      return p;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/codigo/i.test(msg) || !/unique|duplicad/i.test(msg)) throw e;
    }
  }
  throw new Error('No se pudo generar un código único para el permiso.');
}

export async function responderPermiso(id: number, autoriza: boolean, firma: ActoFirma): Promise<void> {
  const filas = await consulta<{ codigo: string }>(
    `update permisos set estado = $2, firma_jefatura = $3::jsonb, actualizada_en = now()
      where id = $1 and estado = 'pendiente_jefatura'
      returning codigo`,
    [id, autoriza ? 'autorizado' : 'rechazado', JSON.stringify(firma)],
  );
  if (!filas.length) throw new Error('Este permiso ya fue respondido.');
  await auditar(firma.rut, 'permiso.respuesta', { codigo: filas[0].codigo, autoriza });
}

export const TEXTO_ESTADO_PERMISO: Record<EstadoPermiso, string> = {
  pendiente_jefatura: 'Esperando a tu jefatura',
  autorizado: 'Autorizado',
  rechazado: 'Rechazado',
};
