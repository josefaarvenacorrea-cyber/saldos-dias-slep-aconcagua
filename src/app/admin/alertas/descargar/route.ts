import ExcelJS from 'exceljs';
import { NextResponse, type NextRequest } from 'next/server';
import { alertasActivas, alertasDeCuentas, NOMBRE_ARCHIVO } from '@/lib/datos';
import { darFormato, respuestaExcel } from '@/lib/descargaExcel';
import { hoyChile } from '@/lib/fechas';
import { usuarioActual } from '@/lib/sesion';

export const runtime = 'nodejs';

const ORDEN = { alta: 0, media: 1, baja: 2, seguimiento: 3 } as const;
const NIVEL = { alta: 'Alta', media: 'Media', baja: 'Baja', seguimiento: 'Seguimiento' } as const;

/** Descarga las alertas (con los mismos filtros de la pantalla) como Excel para corregir. */
export async function GET(req: NextRequest) {
  const u = await usuarioActual();
  if (!u || u.rol !== 'admin' || u.debe_cambiar) return NextResponse.redirect(new URL('/ingresar', req.url));
  const p = req.nextUrl.searchParams;
  const nivel = p.get('nivel') ?? '';
  const archivo = p.get('archivo') ?? '';
  const q = (p.get('q') ?? '').trim().toLowerCase();
  const alertas = [...(await alertasActivas()), ...(await alertasDeCuentas())]
    .filter((a) => (!nivel || a.nivel === nivel) && (!archivo || a.archivo === archivo) && (!q || `${a.nombre} ${a.rut} ${a.alerta} ${a.detalle}`.toLowerCase().includes(q)))
    .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel] || a.archivo.localeCompare(b.archivo) || a.hoja.localeCompare(b.hoja) || (a.fila ?? 0) - (b.fila ?? 0));

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Mis días · SLEP Aconcagua';
  const hoja = libro.addWorksheet('Alertas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    { header: 'Prioridad', key: 'nivel', width: 13 },
    { header: 'Archivo', key: 'archivo', width: 30 },
    { header: 'Hoja', key: 'hoja', width: 26 },
    { header: 'Fila', key: 'fila', width: 7 },
    { header: 'RUT', key: 'rut', width: 13 },
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Alerta', key: 'alerta', width: 42 },
    { header: 'Detalle', key: 'detalle', width: 80 },
  ];
  for (const a of alertas) {
    hoja.addRow({ nivel: NIVEL[a.nivel], archivo: NOMBRE_ARCHIVO[a.archivo], hoja: a.hoja, fila: a.fila ?? '', rut: a.rut, nombre: a.nombre, alerta: a.alerta, detalle: a.detalle });
  }
  darFormato(hoja);
  return respuestaExcel(libro, `alertas-saldos-${hoyChile()}.xlsx`);
}
