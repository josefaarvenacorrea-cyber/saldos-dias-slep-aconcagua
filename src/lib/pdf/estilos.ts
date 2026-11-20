import { StyleSheet } from '@react-pdf/renderer';

/**
 * Estilos compartidos por los dos formularios en PDF.
 *
 * Los azules son los de los formularios institucionales: el de permisos usa un azul más claro en
 * los títulos y el de postergación uno más oscuro en toda la tabla.
 */
export const AZUL = '#005392';
export const AZUL_CLARO = '#0f69b3';
export const AZUL_OSCURO = '#003b8d';
export const AZUL_PALIDO = '#eaf1fb';
export const VERDE = '#17794a';
export const GRIS = '#5b6670';

export const comunes = StyleSheet.create({
  pagina: { paddingTop: 26, paddingHorizontal: 34, paddingBottom: 20, fontSize: 9, color: '#20292f' },
  fila: { flexDirection: 'row' },
  // Bloque que queda bajo cada firma y es lo que hace verificable el documento.
  acto: { marginTop: 3, paddingTop: 3, borderTopWidth: 0.6, borderTopColor: '#c6d4e0' },
  actoTitulo: { fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: VERDE, letterSpacing: 0.3 },
  actoTexto: { fontSize: 6.4, color: '#2a3a47', lineHeight: 1.35 },
  actoCodigo: { fontSize: 6.4, fontFamily: 'Courier-Bold', color: AZUL },
  verificacion: { marginTop: 10, paddingTop: 5, borderTopWidth: 0.6, borderTopColor: '#e3eaf0', fontSize: 6.2, color: GRIS, lineHeight: 1.4 },
});
