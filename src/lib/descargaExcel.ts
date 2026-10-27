import type ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

/** Formato común de las descargas: Arial, encabezado azul institucional y filtro en la primera fila. */
export function darFormato(hoja: ExcelJS.Worksheet): void {
  hoja.eachRow((fila, n) => {
    fila.eachCell((c) => {
      c.font = { name: 'Arial', size: 10, bold: n === 1, color: n === 1 ? { argb: 'FFFFFFFF' } : undefined };
      c.alignment = { vertical: 'top', wrapText: true };
      if (n === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF092039' } };
    });
  });
  if (hoja.rowCount > 1) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
}

export async function respuestaExcel(libro: ExcelJS.Workbook, nombreArchivo: string): Promise<NextResponse> {
  const buffer = await libro.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Cache-Control': 'no-store',
    },
  });
}
