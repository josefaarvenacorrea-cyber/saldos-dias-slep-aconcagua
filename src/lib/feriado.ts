import type { FichaDias } from './tipos.ts';

/**
 * Días de feriado legal que se pierden si no se usan antes de que termine el año de la base.
 * Los días acumulados de años anteriores no se pueden postergar otra vez (los del año en curso sí,
 * al año siguiente). Lo usado en el año se descuenta primero de los acumulados, así que se pierde
 * lo que quede de ellos.
 */
export function feriadoPorVencer(fl: FichaDias['feriadoLegal']): number {
  const quedan = Math.min(fl.acumuladoAnterior - fl.usados, fl.saldo);
  return quedan > 1e-9 ? Math.round(quedan * 100) / 100 : 0;
}

/**
 * Días de feriado legal que sí se pueden postergar al año siguiente: los del año en curso.
 * Es el saldo menos los días acumulados de años anteriores que están por vencer.
 */
export function feriadoPostergable(fl: FichaDias['feriadoLegal']): number {
  const quedan = fl.saldo - feriadoPorVencer(fl);
  return quedan > 1e-9 ? Math.round(quedan * 100) / 100 : 0;
}
