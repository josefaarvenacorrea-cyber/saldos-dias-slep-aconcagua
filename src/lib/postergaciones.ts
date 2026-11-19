import 'server-only';
import { consulta, auditar } from './db.ts';
import { PROCESO_POSTERGACION } from './postergacion.ts';

/**
 * Solicitudes de postergación de feriado legal, con las tres secciones del formulario:
 * I el funcionario pide su feriado, II la jefatura lo deniega por buen servicio y propone postergar,
 * III el funcionario acepta y declara cuántos días acumula. Cada sección se cierra con la firma de
 * quien corresponde y queda registrada con fecha, hora y dirección IP.
 */

export type EstadoPostergacion =
  | 'pendiente_jefatura'
  | 'pendiente_funcionario'
  | 'completa'
  | 'sin_postergacion'
  | 'desistida';

/** Quién firmó, cuándo y desde dónde. Es lo que hace verificable el documento. */
export interface ActoFirma {
  nombre: string;
  rut: string;
  en: string;
  ip: string | null;
}

/** Copia de los datos de la persona al momento de solicitar, para que el documento no cambie después. */
export interface FichaPostergacion {
  nombre: string;
  rutTexto: string;
  cargo: string;
  grado: string;
  estamento: string;
  unidad: string;
  jefaturaNombre: string;
  postergableAlSolicitar: number;
  porVencerAlSolicitar: number;
}

export interface Postergacion {
  id: number;
  codigo: string;
  anio: number;
  rut: string;
  jefaturaRut: string | null;
  ficha: FichaPostergacion;
  diasSolicitados: number;
  fechaInicio: string | null;
  diasAcumular: number | null;
  estado: EstadoPostergacion;
  firmaSolicitud: ActoFirma | null;
  firmaJefatura: ActoFirma | null;
  firmaAceptacion: ActoFirma | null;
  creadaEn: Date;
  actualizadaEn: Date;
}

type Fila = {
  id: number;
  codigo: string;
  anio: number;
  rut: string;
  jefatura_rut: string | null;
  ficha: FichaPostergacion;
  dias_solicitados: string | number;
  fecha_inicio: string | Date | null;
  dias_acumular: string | number | null;
  estado: EstadoPostergacion;
  firma_solicitud: ActoFirma | null;
  firma_jefatura: ActoFirma | null;
  firma_aceptacion: ActoFirma | null;
  creada_en: string | Date;
  actualizada_en: string | Date;
};

const COLUMNAS = `id, codigo, anio, rut, jefatura_rut, ficha, dias_solicitados, fecha_inicio,
  dias_acumular, estado, firma_solicitud, firma_jefatura, firma_aceptacion, creada_en, actualizada_en`;

function iso(v: string | Date | null): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

function desdeFila(f: Fila): Postergacion {
  return {
    id: f.id,
    codigo: f.codigo,
    anio: f.anio,
    rut: f.rut,
    jefaturaRut: f.jefatura_rut,
    ficha: f.ficha ?? ({} as FichaPostergacion),
    diasSolicitados: Number(f.dias_solicitados),
    fechaInicio: iso(f.fecha_inicio),
    diasAcumular: f.dias_acumular === null ? null : Number(f.dias_acumular),
    estado: f.estado,
    firmaSolicitud: f.firma_solicitud,
    firmaJefatura: f.firma_jefatura,
    firmaAceptacion: f.firma_aceptacion,
    creadaEn: new Date(f.creada_en),
    actualizadaEn: new Date(f.actualizada_en),
  };
}

function nuevoCodigo(): string {
  const azar = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MD-${PROCESO_POSTERGACION.anioDestino}-P${azar}`;
}

/** La solicitud de esta persona para el año del proceso, en cualquier estado. */
export async function solicitudDe(rut: string, anio = PROCESO_POSTERGACION.anioAPostergar): Promise<Postergacion | null> {
  const filas = await consulta<Fila>(
    `select ${COLUMNAS} from postergaciones where rut = $1 and anio = $2 order by id desc limit 1`,
    [rut, anio],
  );
  return filas.length ? desdeFila(filas[0]) : null;
}

export async function porCodigo(codigo: string): Promise<Postergacion | null> {
  const filas = await consulta<Fila>(`select ${COLUMNAS} from postergaciones where codigo = $1`, [codigo.trim().toUpperCase()]);
  return filas.length ? desdeFila(filas[0]) : null;
}

export async function porId(id: number): Promise<Postergacion | null> {
  const filas = await consulta<Fila>(`select ${COLUMNAS} from postergaciones where id = $1`, [id]);
  return filas.length ? desdeFila(filas[0]) : null;
}

/** Solicitudes esperando la firma de esta jefatura. */
export async function pendientesDeJefatura(rutJefatura: string): Promise<Postergacion[]> {
  const filas = await consulta<Fila>(
    `select ${COLUMNAS} from postergaciones
      where jefatura_rut = $1 and estado = 'pendiente_jefatura' order by creada_en`,
    [rutJefatura],
  );
  return filas.map(desdeFila);
}

/** Todo lo que esta jefatura ya respondió, para que pueda volver a mirarlo. */
export async function respondidasPorJefatura(rutJefatura: string): Promise<Postergacion[]> {
  const filas = await consulta<Fila>(
    `select ${COLUMNAS} from postergaciones
      where jefatura_rut = $1 and estado <> 'pendiente_jefatura' order by actualizada_en desc limit 100`,
    [rutJefatura],
  );
  return filas.map(desdeFila);
}

/** Todas las solicitudes del año, para la administración. */
export async function todas(anio = PROCESO_POSTERGACION.anioAPostergar): Promise<Postergacion[]> {
  const filas = await consulta<Fila>(
    `select ${COLUMNAS} from postergaciones where anio = $1 order by creada_en desc`,
    [anio],
  );
  return filas.map(desdeFila);
}

/** Sección I: el funcionario pide su feriado y firma. */
export async function crearSolicitud(datos: {
  rut: string;
  jefaturaRut: string | null;
  ficha: FichaPostergacion;
  diasSolicitados: number;
  fechaInicio: string | null;
  firma: ActoFirma;
  anio?: number;
}): Promise<Postergacion> {
  const anio = datos.anio ?? PROCESO_POSTERGACION.anioAPostergar;
  for (let intento = 0; intento < 5; intento++) {
    try {
      const filas = await consulta<Fila>(
        `insert into postergaciones
           (codigo, anio, rut, jefatura_rut, ficha, dias_solicitados, fecha_inicio, estado, firma_solicitud)
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, 'pendiente_jefatura', $8::jsonb)
         returning ${COLUMNAS}`,
        [
          nuevoCodigo(),
          anio,
          datos.rut,
          datos.jefaturaRut,
          JSON.stringify(datos.ficha),
          datos.diasSolicitados,
          datos.fechaInicio,
          JSON.stringify(datos.firma),
        ],
      );
      const p = desdeFila(filas[0]);
      await auditar(datos.rut, 'postergacion.solicitud', { codigo: p.codigo, dias: p.diasSolicitados });
      return p;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Choque de código al azar: se reintenta. Cualquier otro error se propaga.
      if (!/codigo/i.test(msg) || !/unique|duplicad/i.test(msg)) throw e;
    }
  }
  throw new Error('No se pudo generar un código único para la solicitud.');
}

/** Sección II: la jefatura responde y firma. Si autoriza el feriado, no hay postergación que tramitar. */
export async function responderJefatura(id: number, autoriza: boolean, firma: ActoFirma): Promise<void> {
  const estado: EstadoPostergacion = autoriza ? 'sin_postergacion' : 'pendiente_funcionario';
  const filas = await consulta<{ codigo: string }>(
    `update postergaciones
        set estado = $2, firma_jefatura = $3::jsonb, actualizada_en = now()
      where id = $1 and estado = 'pendiente_jefatura'
      returning codigo`,
    [id, estado, JSON.stringify(firma)],
  );
  if (!filas.length) throw new Error('La solicitud ya fue respondida.');
  await auditar(firma.rut, 'postergacion.jefatura', { codigo: filas[0].codigo, autoriza });
}

/** Sección III: el funcionario acepta la postergación y declara los días, o desiste. */
export async function responderFuncionario(
  id: number,
  acepta: boolean,
  diasAcumular: number | null,
  firma: ActoFirma,
): Promise<void> {
  const estado: EstadoPostergacion = acepta ? 'completa' : 'desistida';
  const filas = await consulta<{ codigo: string }>(
    `update postergaciones
        set estado = $2, dias_acumular = $3, firma_aceptacion = $4::jsonb, actualizada_en = now()
      where id = $1 and estado = 'pendiente_funcionario'
      returning codigo`,
    [id, estado, acepta ? diasAcumular : null, JSON.stringify(firma)],
  );
  if (!filas.length) throw new Error('La solicitud ya fue respondida.');
  await auditar(firma.rut, 'postergacion.aceptacion', { codigo: filas[0].codigo, acepta, dias: diasAcumular });
}

export const TEXTO_ESTADO: Record<EstadoPostergacion, string> = {
  pendiente_jefatura: 'Esperando la respuesta de tu jefatura',
  pendiente_funcionario: 'Esperando que aceptes la postergación',
  completa: 'Postergación solicitada',
  sin_postergacion: 'Feriado autorizado, sin postergación',
  desistida: 'Desistida por el funcionario',
};
