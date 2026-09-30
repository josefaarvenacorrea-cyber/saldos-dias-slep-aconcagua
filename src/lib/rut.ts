// Utilidades de RUT. A las personas se las identifica por el número (sin dígito verificador),
// porque en los Excel el dígito a veces viene mal escrito (por ejemplo, al arrastrar celdas).

/** Quita puntos y espacios y deja la K en mayúscula: " 12.345.678-k " → "12345678-K". */
export function limpiarRut(valor: unknown): string {
  return String(valor ?? '')
    .replace(/[.\s]/g, '')
    .replace(/[‐–—]/g, '-')
    .toUpperCase()
    .trim();
}

/** Número del RUT, sin dígito verificador: "12.345.678-5" → "12345678". */
export function numeroRut(valor: unknown): string {
  return limpiarRut(valor).split('-')[0].replace(/\D/g, '');
}

/** Dígito verificador que corresponde a un número de RUT (módulo 11). */
export function dvDe(numero: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
}

export function rutValido(valor: unknown): boolean {
  const m = limpiarRut(valor).match(/^(\d{7,8})-([\dK])$/);
  return !!m && dvDe(m[1]) === m[2];
}

/** "12345678" → "12.345.678-5" (con el dígito verificador calculado). */
export function formatearRut(numero: string): string {
  if (!numero) return '';
  return `${numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dvDe(numero)}`;
}

/** Contraseña inicial: los cuatro primeros dígitos del RUT, sin puntos. */
export function claveInicialDe(numero: string): string {
  return numero.slice(0, 4);
}
