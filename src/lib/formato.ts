const numeroCL = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** 3.5 → "3,5" */
export function numero(n: number): string {
  return numeroCL.format(Math.round(n * 100) / 100);
}

/** 1 → "1 día", 3.5 → "3,5 días" */
export function dias(n: number): string {
  return `${numero(n)} ${Math.abs(n) === 1 ? 'día' : 'días'}`;
}

/** 55.25 → "55 h 15 min", 8 → "8 h", -3.5 → "−3 h 30 min" */
export function horas(n: number): string {
  const signo = n < 0 ? '−' : '';
  const totalMin = Math.round(Math.abs(n) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${signo}${h} h`;
  if (h === 0) return `${signo}${m} min`;
  return `${signo}${h} h ${m} min`;
}

export function porcentaje(parte: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (parte / total) * 100));
}
