// Crea tres Excel de PRUEBA (personas ficticias) con el mismo formato que los reales,
// para probar la plataforma sin usar datos personales. Salen en .datos-prueba/
// Uso: node --experimental-strip-types scripts/crear-datos-prueba.ts
import { mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { dvDe } from '../src/lib/rut.ts';

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const horas = (h: number) => new Date(Date.UTC(1899, 11, 30) + h * 3_600_000); // celda [h]:mm

const personas = [
  { num: '11111111', nombre: 'Ana Prueba Ficticia', area: 'Dirección Ejecutiva', correo: 'ana.prueba@ejemplo.cl' },
  { num: '22222222', nombre: 'Bruno Ejemplo Demo', area: 'Subdirección de Administración y Finanzas', correo: 'bruno.ejemplo@ejemplo.cl' },
  { num: '15555555', nombre: 'Carla Muestra Test', area: 'Subdirección de Gestión y Desarrollo de Personas', correo: 'carla.muestra@ejemplo.cl' },
].map((p) => ({ ...p, rut: `${p.num}-${dvDe(p.num)}` }));

await mkdir('.datos-prueba', { recursive: true });

// ---------- Días ----------
{
  const libro = new ExcelJS.Workbook();
  const s = libro.addWorksheet('SALDOS');
  const enc = ['RUT-DV', 'RUT', 'DV', 'PROGRAMA', 'NOMBRE COMPLETO', 'ÁREA/SUBDIRECCIÓN', 'CARGO', 'ESTAMENTO', 'CALIDAD JURIDICA', 'GRADO', 'FECHA DE INGRESO SLEP', 'SALDO INICIAL DÍAS ADMINISTRATIVOS', ...MESES, 'SALDO DIAS ', 'x', 'DÍAS ACUMULADOS AÑO ANTERIOR', 'DIAS ANUALIDAD', 'SALDO INICIAL DÍAS FERIADO LEGAL', ...MESES, 'SALDO DIAS ', 'USO DE OTROS PERMISOS ESPECIALES', 'OBSERVACIONES'];
  s.getRow(2).values = enc;
  s.mergeCells('A1:K1');
  s.getCell('A1').value = 'DATOS FUNCIONARIO/A';
  s.mergeCells('L1:Y1');
  s.getCell('L1').value = 'PERMISO ADMINISTRATIVO';
  s.mergeCells('AA1:AP1');
  s.getCell('AA1').value = 'FERIADO LEGAL';
  const usoAdm = [[0, 1, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
  const usoFl = [[0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0]];
  personas.forEach((p, i) => {
    s.getRow(3 + i).values = [p.rut, Number(p.num), dvDe(p.num), '01', p.nombre, p.area, 'Profesional', 'Profesional', 'Contrata', 7, d('2025-03-01'), 6, ...usoAdm[i], null, null, 10, 15, null, ...usoFl[i], null, i === 0 ? '1 día de permiso por matrimonio (prueba)' : null, null];
  });
  const det = libro.addWorksheet('Detalle uso');
  det.getRow(1).values = ['RUT-DV', 'RUT', 'DV', 'PROGRAMA', 'NOMBRE COMPLETO', 'ÁREA/SUBDIRECCIÓN', 'Tipo', 'N° Dias', 'Fecha inicio', 'Fecha termino', 'Código', 'Comentarios'];
  const [a, b, c] = personas;
  const filas: [typeof a, string, number, string, string | null, string | null][] = [
    [a, 'Con Goce de Remuneraciones', 1, '2026-02-10', null, null],
    [a, 'Con Goce de Remuneraciones', 0.5, '2026-04-08', null, null],
    [a, 'Con Goce de Remuneraciones', 1, '2026-09-09', null, 'Pendiente solicitud firmada'],
    [a, 'Feriado Legal', 5, '2026-02-16', '2026-02-20', null],
    [b, 'Con Goce de Remuneraciones', 2, '2026-07-06', null, null],
    [b, 'Con Goce de Remuneraciones', 2, '2026-07-06', null, null], // repetida a propósito
    [c, 'Feriado Legal', 3, '2026-06-24', null, null],
  ];
  filas.forEach(([p, tipo, n, ini, fin, com], i) => {
    const rutEscrito = i === 6 ? `${p.num}-${(Number(dvDe(p.num)) + 1) % 10}` : p.rut; // dígito corrido a propósito
    det.getRow(2 + i).values = [rutEscrito, Number(p.num), dvDe(p.num), '01', p.nombre, p.area, tipo, n, d(ini), fin ? d(fin) : null, null, com];
  });
  await libro.xlsx.writeFile('.datos-prueba/dias-prueba.xlsx');
}

// ---------- Descansos ----------
{
  const libro = new ExcelJS.Workbook();
  const r = libro.addWorksheet('DESCANSOS COMPLEMENTARIOS');
  r.getRow(2).values = ['RUT-DV', 'PROGRAMA', 'NOMBRE COMPLETO', 'ÁREA/SUBDIRECCIÓN', 'REX. 192', 'ABRIL', 'MAYO', 'SALDO HORAS ', 'x', ...MESES, 'SALDO PARA USO '];
  r.mergeCells('A1:D1');
  r.getCell('A1').value = 'DATOS FUNCIONARIO/A';
  r.mergeCells('E1:H1');
  r.getCell('E1').value = 'DESCANSO COMPLEMENTARIO (HORAS RECONOCIDAS)';
  r.mergeCells('J1:V1');
  r.getCell('J1').value = 'DESCANSO COMPLEMENTARIO (HORAS UTILIZADAS)';
  const [a, b] = personas;
  r.getRow(3).values = [a.rut, '01', a.nombre, a.area, horas(12.5), horas(4), horas(0), null, null, ...[0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0].map(horas), null];
  r.getRow(4).values = [b.rut, '01', b.nombre, b.area, horas(6), horas(0), horas(0), null, null, ...[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(horas), null];
  for (const row of [3, 4]) for (let col = 5; col <= 22; col++) r.getRow(row).getCell(col).numFmt = '[h]:mm';
  const rex = libro.addWorksheet('REX. 192');
  rex.getRow(1).values = ['N°', 'RUT', 'NOMBRE COMPLETO', 'N° HORAS DIURNAS A RECONOCER', 'N° HORAS DIURNAS INCR. EN 25%/50%', 'FECHA EXPIRA- CIÓN'];
  rex.getRow(2).values = [1, a.rut, a.nombre, horas(10), horas(12.5), d('2028-03-20')];
  rex.getRow(3).values = [2, b.rut, b.nombre, horas(5), horas(6), d('2028-03-20')];
  const det = libro.addWorksheet('Detalle Uso');
  det.getRow(1).values = ['RUT-DV', 'PROGRAMA', 'NOMBRE COMPLETO', 'ÁREA/SUBDIRECCIÓN', 'Tipo', 'N° Horas', 'Fecha inicio', 'Fecha termino', 'Código'];
  det.getRow(2).values = [a.rut, '01', a.nombre, a.area, 'Descanso Complementario', 8, d('2026-05-22'), d('2026-05-22'), null];
  det.getRow(3).values = [a.rut, '01', a.nombre, a.area, 'Descanso Complementario', 3, d('2026-08-14'), d('2026-08-14'), null];
  await libro.xlsx.writeFile('.datos-prueba/descansos-prueba.xlsx');
}

// ---------- Dotación ----------
{
  const libro = new ExcelJS.Workbook();
  const h = libro.addWorksheet('Hoja1');
  h.getRow(1).values = ['RUT-DV', 'RUT', 'DV', 'ORIGEN', 'PROGRAMA', 'NOMBRE COMPLETO', 'ÁREA/SUBDIRECCIÓN', 'CARGO', 'ESTAMENTO', 'CALIDAD JURIDICA', 'GRADO', 'FECHA DE INGRESO SLEP', 'TIPO DE CONTRATACIÓN', 'SEXO', 'CORREO INSTITUCIONAL', 'Jefatura'];
  personas.forEach((p, i) => {
    h.getRow(2 + i).values = [p.rut, Number(p.num), dvDe(p.num), 'SLEP', '01', p.nombre, p.area, 'Analista de prueba', 'Profesional', 'Contrata', 7, d('2025-03-01'), 'Contrata', 'M', i === 2 ? null : p.correo, 'Jefatura de prueba'];
  });
  await libro.xlsx.writeFile('.datos-prueba/dotacion-prueba.xlsx');
}

console.log('Listo: .datos-prueba/dias-prueba.xlsx, descansos-prueba.xlsx y dotacion-prueba.xlsx');
