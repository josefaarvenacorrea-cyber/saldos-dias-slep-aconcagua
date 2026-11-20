'use server';

import { revalidatePath } from 'next/cache';
import { actoDe } from '@/lib/acto';
import { fichaDe } from '@/lib/datos';
import { firmaDe } from '@/lib/firmas';
import { jefaturaDe } from '@/lib/jefaturas';
import { crearPermiso, saldosDisponibles } from '@/lib/permisos';
import { avisarPermisoPendiente } from '@/lib/webhook';
import {
  planRecuperacion,
  revisar,
  totalDias,
  totalMinutos,
  type CausalOtros,
  type DiaPedido,
  type Jornada,
  type Recuperacion,
  type TipoPermiso,
} from '@/lib/reglasPermisos';
import { formatearRut } from '@/lib/rut';
import { requerirUsuario } from '@/lib/sesion';

export interface EstadoPermisoForm {
  error?: string;
}

const TIPOS_VALIDOS = ['feriado', 'goce', 'compensatorio', 'interferiado', 'otros'] as const;
const JORNADAS = ['completa', 'am', 'pm'] as const;

/** Lee los días que mandó la pantalla sin confiar en su contenido. */
function leerDias(bruto: string): DiaPedido[] {
  let datos: unknown;
  try {
    datos = JSON.parse(bruto);
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];
  const salida: DiaPedido[] = [];
  for (const d of datos.slice(0, 70)) {
    if (!d || typeof d !== 'object') continue;
    const fecha = String((d as DiaPedido).fecha ?? '');
    const jornada = String((d as DiaPedido).jornada ?? '') as Jornada;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !JORNADAS.includes(jornada)) continue;
    salida.push({ fecha, jornada });
  }
  return salida;
}

/** El funcionario pide su permiso y firma. */
export async function pedirPermiso(_: EstadoPermisoForm, form: FormData): Promise<EstadoPermisoForm> {
  const u = await requerirUsuario();
  if (u.rol !== 'funcionario' || !u.rut) return { error: 'Solo los funcionarios pueden solicitar permisos.' };

  const firma = await firmaDe(u.id);
  if (!firma) return { error: 'Primero tienes que guardar tu firma en Mi firma.' };

  const tipo = String(form.get('tipo') ?? '') as TipoPermiso;
  if (!TIPOS_VALIDOS.includes(tipo)) return { error: 'Elige el tipo de permiso.' };

  const dias = leerDias(String(form.get('dias') ?? ''));
  const horaDesde = String(form.get('horaDesde') ?? '');
  const horaHasta = String(form.get('horaHasta') ?? '');
  const certificado = String(form.get('certificado') ?? '').trim() || null;

  // El plan de devolución se vuelve a calcular en el servidor a partir de los tres datos que lo
  // definen, para no confiar en el calendario que mandó la pantalla.
  let recuperacion: Recuperacion | null = null;
  if (tipo === 'interferiado') {
    const horas = Number(String(form.get('horasDevolver') ?? '').replace(',', '.'));
    const horasPorDia = Number(String(form.get('horasPorDia') ?? '').replace(',', '.'));
    const desde = String(form.get('recuperarDesde') ?? '');
    recuperacion = {
      horas: Number.isFinite(horas) ? horas : 0,
      horasPorDia: Number.isFinite(horasPorDia) ? horasPorDia : 0,
      desde,
      dias: planRecuperacion(desde, horas, horasPorDia),
    };
  }

  // Se revisa de nuevo en el servidor contra el saldo real: la pantalla puede venir manipulada.
  const { saldos } = await saldosDisponibles(u.rut);
  const revision = revisar({ tipo, dias, horaDesde, horaHasta, certificado, recuperacion }, saldos);
  if (!revision.ok) return { error: revision.error ?? 'La solicitud tiene un problema.' };

  const jefatura = await jefaturaDe(u.rut);
  if (!jefatura) {
    return { error: 'No pude identificar a tu jefatura en la Dotación. Avísale a Gestión de Personas para que la asigne.' };
  }

  const ficha = await fichaDe(u.rut);
  const d = ficha.dotacion;
  const porHoras = tipo === 'compensatorio';

  const creado = await crearPermiso({
    rut: u.rut,
    jefaturaRut: jefatura.rut,
    ficha: {
      nombre: d?.nombre || ficha.dias?.nombre || u.nombre || '',
      rutTexto: d?.rutTexto || ficha.dias?.rutTexto || formatearRut(u.rut),
      cargo: d?.cargo ?? '',
      grado: d?.grado ?? '',
      estamento: d?.estamento ?? '',
      unidad: d?.area || ficha.dias?.area || '',
      jefaturaNombre: jefatura.nombre,
    },
    tipo,
    causal: tipo === 'otros' ? ((String(form.get('causal') ?? '') || null) as CausalOtros | null) : null,
    detalle: tipo === 'otros' ? String(form.get('detalle') ?? '').trim() || null : null,
    certificado,
    dias,
    recuperacion,
    totalDias: porHoras ? 0 : totalDias(dias),
    horaDesde: porHoras ? horaDesde : null,
    horaHasta: porHoras ? horaHasta : null,
    totalMinutos: porHoras ? totalMinutos(horaDesde, horaHasta) : 0,
    firma: await actoDe(d?.nombre || u.nombre || '', formatearRut(u.rut)),
  });
  // La jefatura se entera por correo de que tiene algo pendiente de firma.
  await avisarPermisoPendiente(creado.id);

  revalidatePath('/mis-dias/permisos');
  revalidatePath('/mis-dias');
  return {};
}
