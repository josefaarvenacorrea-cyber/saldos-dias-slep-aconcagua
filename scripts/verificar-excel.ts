// Lee los Excel con los mismos lectores de la plataforma y muestra un resumen sin datos personales.
// Uso: node --experimental-strip-types scripts/verificar-excel.ts dias.xlsx descansos.xlsx dotacion.xlsx
import { readFile } from 'node:fs/promises';
import { leerDias } from '../src/lib/excel/dias.ts';
import { leerDescansos } from '../src/lib/excel/descansos.ts';
import { leerDotacion } from '../src/lib/excel/dotacion.ts';
import type { Alerta } from '../src/lib/tipos.ts';

const [dias, descansos, dotacion] = process.argv.slice(2);

function conteo(alertas: Alerta[]) {
  const c: Record<string, number> = {};
  for (const a of alertas) {
    const k = `${a.nivel} · ${a.alerta.replace(/".*"/, '"…"').replace(/fuera de \d+/, 'fuera del año')}`;
    c[k] = (c[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(c).sort());
}

if (dias) {
  const r = await leerDias(await readFile(dias));
  const ps = Object.values(r.personas);
  console.log('\n== DÍAS ==', r.resumen);
  console.log('saldos negativos adm/fl:', ps.filter((p) => p.administrativos.saldo < 0).length, ps.filter((p) => p.feriadoLegal.saldo < 0).length);
  console.log('descuadres adm/fl:', ps.filter((p) => p.administrativos.usados !== p.administrativos.usadosSegunResumen).length, ps.filter((p) => p.feriadoLegal.usados !== p.feriadoLegal.usadosSegunResumen).length);
  console.log('solicitudes por tipo:', ps.flatMap((p) => p.solicitudes).reduce<Record<string, number>>((a, s) => ((a[s.tipo] = (a[s.tipo] ?? 0) + 1), a), {}));
  console.log(conteo(r.alertas));
}
if (descansos) {
  const r = await leerDescansos(await readFile(descansos));
  const ps = Object.values(r.personas);
  console.log('\n== DESCANSOS ==', r.resumen);
  console.log('con horas reconocidas:', ps.filter((p) => p.totalReconocidas > 0).length, '| saldo negativo:', ps.filter((p) => p.saldo < 0).length, '| con vencimiento conocido:', ps.filter((p) => p.reconocidas.some((x) => x.vence)).length);
  console.log(conteo(r.alertas));
}
if (dotacion) {
  const r = await leerDotacion(await readFile(dotacion));
  console.log('\n== DOTACIÓN ==', r.resumen);
  console.log(conteo(r.alertas));
}
