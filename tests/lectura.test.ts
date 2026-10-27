import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dvDe, formatearRut, numeroRut, rutValido, claveInicialDe } from '../src/lib/rut.ts';
import { repartirDiasHabiles, diasHabilesEntre, diasHabilesRestantesDelAnio } from '../src/lib/fechas.ts';
import { feriadoPorVencer } from '../src/lib/feriado.ts';
import { horas, numero } from '../src/lib/formato.ts';
import { leerDias } from '../src/lib/excel/dias.ts';
import { leerDescansos } from '../src/lib/excel/descansos.ts';
import { leerDotacion } from '../src/lib/excel/dotacion.ts';

// Genera los Excel ficticios de prueba.
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/crear-datos-prueba.ts']);

test('RUT: dígito verificador, formato y clave inicial', () => {
  assert.equal(dvDe('11111111'), '1');
  assert.equal(dvDe('22222222'), '2');
  assert.equal(numeroRut(' 12.345.678-k '), '12345678');
  assert.ok(rutValido('11.111.111-1'));
  assert.ok(!rutValido('11111111-2'));
  assert.equal(formatearRut('22222222'), '22.222.222-2');
  assert.equal(claveInicialDe('9876543'), '9876');
});

test('Fechas: reparto en días hábiles, saltando fin de semana y feriados', () => {
  // viernes 17-09-2026 + 2 días: el 18 es feriado y el 19-20 fin de semana → 17 y 21
  assert.deepEqual(repartirDiasHabiles('2026-09-17', 2).map((d) => d.fecha), ['2026-09-17', '2026-09-21']);
  assert.deepEqual(repartirDiasHabiles('2026-03-05', 0.5), [{ fecha: '2026-03-05', fraccion: 0.5 }]);
  assert.equal(diasHabilesEntre('2026-02-16', '2026-02-25'), 8);
});

test('Formato de números y horas', () => {
  assert.equal(numero(3.5), '3,5');
  assert.equal(horas(55.25), '55 h 15 min');
  assert.equal(horas(-3.5), '−3 h 30 min');
});

test('Días: saldo = inicial − detalle, sin contar repetidas, con RUT de dígito corrido', async () => {
  const r = await leerDias(await readFile('.datos-prueba/dias-prueba.xlsx'));
  assert.equal(r.resumen.funcionarios, 3);
  assert.equal(r.resumen.repetidas, 1);
  const ana = r.personas['11111111'];
  assert.equal(ana.administrativos.saldo, 3.5);
  assert.equal(ana.feriadoLegal.inicial, 25);
  assert.equal(ana.feriadoLegal.saldo, 20);
  assert.equal(r.personas['22222222'].administrativos.usados, 2); // la repetida no se cuenta
  assert.equal(r.personas['15555555'].feriadoLegal.usados, 3); // dígito corrido igual se asigna
  assert.ok(r.alertas.some((a) => a.alerta === 'RUT-DV distinto al de SALDOS'));
  assert.ok(r.alertas.some((a) => a.alerta === 'Solicitud repetida'));
});

test('Feriado legal por vencer: lo usado se descuenta primero de los días acumulados', async () => {
  const r = await leerDias(await readFile('.datos-prueba/dias-prueba.xlsx'));
  // Las tres personas tienen 10 días acumulados y 15 del año.
  assert.equal(feriadoPorVencer(r.personas['11111111'].feriadoLegal), 5); // usó 5
  assert.equal(feriadoPorVencer(r.personas['22222222'].feriadoLegal), 10); // no ha usado
  assert.equal(feriadoPorVencer(r.personas['15555555'].feriadoLegal), 7); // usó 3
  const base = { acumuladoAnterior: 10, anualidad: 15, inicial: 25, usadosSegunResumen: 0 };
  assert.equal(feriadoPorVencer({ ...base, usados: 12, saldo: 13 }), 0); // ya usó los acumulados: los del año se pueden postergar
  assert.equal(feriadoPorVencer({ ...base, usados: 7.5, saldo: 17.5 }), 2.5);
  assert.equal(feriadoPorVencer({ ...base, acumuladoAnterior: 0, usados: 0, saldo: 15 }), 0);
});

test('Días hábiles que quedan en el año, desde mañana', () => {
  assert.equal(diasHabilesRestantesDelAnio('2026-10-27'), 45);
  assert.equal(diasHabilesRestantesDelAnio('2026-12-30'), 1);
  assert.equal(diasHabilesRestantesDelAnio('2026-12-31'), 0);
});

test('Descansos: horas reconocidas con vencimiento y saldo', async () => {
  const r = await leerDescansos(await readFile('.datos-prueba/descansos-prueba.xlsx'));
  const ana = r.personas['11111111'];
  assert.equal(ana.totalReconocidas, 16.5);
  assert.equal(ana.usadas, 11);
  assert.equal(ana.saldo, 5.5);
  assert.equal(ana.reconocidas.find((x) => x.fuente.includes('192'))?.vence, '2028-03-20');
});

test('Dotación: correos y personas sin correo', async () => {
  const r = await leerDotacion(await readFile('.datos-prueba/dotacion-prueba.xlsx'));
  assert.equal(r.resumen.funcionarios, 3);
  assert.equal(r.resumen.conCorreo, 2);
  assert.equal(r.personas['11111111'].correoInstitucional, 'ana.prueba@ejemplo.cl');
});
