import ExcelJS from 'exceljs';
import { NextResponse, type NextRequest } from 'next/server';
import { feriadoPorVencerLista } from '@/lib/datos';
import { darFormato, respuestaExcel } from '@/lib/descargaExcel';
import { anioActualChile, fechaHoraChile, hoyChile } from '@/lib/fechas';
import { usuarioActual } from '@/lib/sesion';

export const runtime = 'nodejs';

/** Descarga en Excel a quienes perderían feriado legal, para hacer seguimiento o escribirles. */
export async function GET(req: NextRequest) {
  const u = await usuarioActual();
  if (!u || u.rol !== 'admin' || u.debe_cambiar) return NextResponse.redirect(new URL('/ingresar', req.url));
  const r = await feriadoPorVencerLista();
  // Con una base de otro año el plazo no corresponde: la lista sale vacía, igual que la pantalla.
  const personas = r.anio === anioActualChile() ? r.personas : [];

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Mis días · SLEP Aconcagua';
  const hoja = libro.addWorksheet('Feriado por vencer', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    { header: 'RUT', key: 'rut', width: 13 },
    { header: 'Nombre', key: 'nombre', width: 34 },
    { header: 'Área', key: 'area', width: 34 },
    { header: 'Correo', key: 'correo', width: 36 },
    { header: 'Días acumulados de años anteriores', key: 'acumulado', width: 16 },
    { header: `Días usados en ${r.anio ?? ''}`.trim(), key: 'usados', width: 14 },
    { header: 'Días por vencer', key: 'porVencer', width: 12 },
    { header: 'Último ingreso a la plataforma', key: 'ingreso', width: 22 },
    { header: 'Revisar', key: 'revisar', width: 40 },
  ];
  for (const p of personas) {
    hoja.addRow({
      rut: p.rutTexto,
      nombre: p.nombre,
      area: p.area,
      correo: p.email ?? 'Sin correo',
      acumulado: p.acumulado,
      usados: p.usados,
      porVencer: p.porVencer,
      ingreso: p.ultimoIngreso ? fechaHoraChile(p.ultimoIngreso) : 'Nunca',
      revisar: p.descuadre ? 'Descuadre entre Detalle uso y SALDOS' : '',
    });
  }
  darFormato(hoja);
  return respuestaExcel(libro, `feriado-por-vencer-${hoyChile()}.xlsx`);
}
