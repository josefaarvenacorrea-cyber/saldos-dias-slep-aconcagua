import { NextResponse, type NextRequest } from 'next/server';
import { guardarCarga } from '@/lib/datos';
import { ErrorFormato } from '@/lib/excel/comun';
import { leerDescansos } from '@/lib/excel/descansos';
import { leerDias } from '@/lib/excel/dias';
import { leerDotacion } from '@/lib/excel/dotacion';
import { usuarioActual } from '@/lib/sesion';
import type { ResultadoLectura, TipoArchivo } from '@/lib/tipos';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAXIMO_BYTES = 8 * 1024 * 1024;
const LECTORES: Record<TipoArchivo, (b: Uint8Array) => Promise<ResultadoLectura<unknown>>> = {
  dias: leerDias,
  descansos: leerDescansos,
  dotacion: leerDotacion,
};

function volver(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/cargas', req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const u = await usuarioActual();
  if (!u || u.rol !== 'admin' || u.debe_cambiar) return NextResponse.redirect(new URL('/ingresar', req.url), 303);
  // Defensa adicional contra envíos desde otros sitios.
  const origen = req.headers.get('origin');
  if (origen && new URL(origen).host !== req.headers.get('host')) return volver(req, { error: 'origen' });

  const form = await req.formData();
  const tipo = String(form.get('tipo') ?? '') as TipoArchivo;
  const archivo = form.get('archivo');
  if (!(tipo in LECTORES)) return volver(req, { error: 'sin-archivo' });
  if (!(archivo instanceof File) || archivo.size === 0) return volver(req, { error: 'sin-archivo' });
  if (archivo.size > MAXIMO_BYTES) return volver(req, { error: 'muy-grande' });

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  // Un .xlsx es un ZIP: empieza con "PK".
  if (!/\.xlsx$/i.test(archivo.name) || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return volver(req, { error: 'no-xlsx' });

  try {
    const lectura = await LECTORES[tipo](bytes);
    await guardarCarga(tipo, archivo.name, u.email ?? 'admin', lectura);
    return volver(req, { ok: 'carga', tipo, alertas: String(lectura.alertas.length) });
  } catch (e) {
    if (e instanceof ErrorFormato) return volver(req, { error: 'formato', detalle: e.message });
    console.error('Error al cargar archivo', e);
    return volver(req, { error: 'inesperado', detalle: 'Ocurrió un error inesperado al procesar el archivo. Intenta nuevamente o revisa el formato.' });
  }
}
