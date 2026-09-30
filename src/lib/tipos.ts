// Tipos compartidos entre la lectura de los Excel, la base de datos y las pantallas.

export type Nivel = 'alta' | 'media' | 'baja' | 'seguimiento';
export type TipoArchivo = 'dias' | 'descansos' | 'dotacion';

export interface Alerta {
  nivel: Nivel;
  archivo: TipoArchivo;
  hoja: string;
  fila: number | null;
  rut: string;
  nombre: string;
  alerta: string;
  detalle: string;
}

export interface DiaUsado {
  fecha: string; // AAAA-MM-DD
  fraccion: number; // 1 = día completo, 0,5 = medio día
}

export type TipoSolicitud = 'administrativo' | 'feriado_legal' | 'descanso' | 'otro';

export interface Solicitud {
  fila: number;
  tipo: TipoSolicitud;
  tipoTexto: string;
  cantidad: number;
  unidad: 'dias' | 'horas';
  inicio: string | null;
  termino: string | null;
  comentario: string | null;
  reparto: DiaUsado[];
}

export interface FichaDias {
  rut: string;
  rutTexto: string;
  nombre: string;
  area: string;
  anio: number;
  administrativos: { inicial: number; usados: number; saldo: number; usadosSegunResumen: number };
  feriadoLegal: {
    acumuladoAnterior: number;
    anualidad: number;
    inicial: number;
    usados: number;
    saldo: number;
    usadosSegunResumen: number;
  };
  otrosPermisos: string | null;
  solicitudes: Solicitud[];
}

export interface HorasReconocidas {
  fuente: string;
  horas: number;
  vence: string | null;
}

export interface FichaDescansos {
  rut: string;
  rutTexto: string;
  nombre: string;
  area: string;
  reconocidas: HorasReconocidas[];
  totalReconocidas: number;
  usadas: number;
  usadasSegunResumen: number;
  saldo: number;
  solicitudes: Solicitud[];
}

export interface FichaDotacion {
  rut: string;
  rutTexto: string;
  nombre: string;
  area: string;
  cargo: string;
  cargoOrganigrama: string;
  estamento: string;
  calidadJuridica: string;
  grado: string;
  fechaIngreso: string | null;
  jefatura: string;
  correoInstitucional: string | null;
  correoPersonal: string | null;
}

export interface ResultadoLectura<T> {
  personas: Record<string, T>;
  alertas: Alerta[];
  resumen: Record<string, number | string>;
}
