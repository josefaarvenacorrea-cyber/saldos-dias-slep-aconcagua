import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { fechaCorta, fechaHoraChile } from '../fechas.ts';
import * as f from '../formato.ts';
import { PROCESO_POSTERGACION } from '../postergacion.ts';
import type { ActoFirma, Postergacion } from '../postergaciones.ts';
import { AZUL_OSCURO, AZUL_PALIDO, comunes } from './estilos.ts';
import { LOGO_ACONCAGUA, LOGO_MINEDUC } from './logos.ts';

/** Réplica en PDF del "Formulario Postergación de Feriado Legal" del SLEP Aconcagua. */

const AZUL = AZUL_OSCURO;

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  logoIzq: { width: 26 },
  logoDer: { width: 104, marginLeft: 'auto' },
  titulo: { textAlign: 'center', fontSize: 13.5, fontFamily: 'Helvetica-Bold', color: AZUL, marginBottom: 16 },

  tabla: { borderWidth: 0.8, borderColor: AZUL, marginBottom: 4 },
  fila: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: AZUL },
  filaUltima: { flexDirection: 'row' },
  etiqueta: { backgroundColor: AZUL_PALIDO, color: AZUL, fontFamily: 'Helvetica-Bold', paddingVertical: 4.5, paddingHorizontal: 7, borderRightWidth: 0.8, borderRightColor: AZUL },
  valor: { paddingVertical: 4.5, paddingHorizontal: 7, justifyContent: 'center' },
  etLarga: { width: 150 },
  etCorta: { width: 62 },

  seccion: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: AZUL, marginTop: 13, marginBottom: 5 },
  declara: { fontSize: 7.4, lineHeight: 1.45, textAlign: 'justify', paddingVertical: 5, paddingHorizontal: 7 },

  celdaFirma: { width: 210, borderLeftWidth: 0.8, borderLeftColor: AZUL, paddingVertical: 7, paddingHorizontal: 8, justifyContent: 'flex-end' },
  firmaImg: { height: 32, marginBottom: 2, objectFit: 'contain', alignSelf: 'center' },
  linea: { borderBottomWidth: 0.9, borderBottomColor: AZUL, marginBottom: 3 },
  firmaPie: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: AZUL, textAlign: 'center' },
  espacioFirma: { height: 32 },

  pie: { marginTop: 14, borderTopWidth: 1.8, borderTopColor: AZUL, paddingTop: 5, textAlign: 'center', fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: AZUL },
});

function Firma({ acto, imagen, pie, sufijo, codigo }: { acto: ActoFirma | null; imagen?: string | null; pie: string; sufijo: string; codigo: string }) {
  return (
    <View style={e.celdaFirma}>
      {acto && imagen ? <Image style={e.firmaImg} src={imagen} /> : <View style={e.espacioFirma} />}
      <View style={e.linea} />
      <Text style={e.firmaPie}>{pie}</Text>
      {acto ? (
        <View style={comunes.acto}>
          <Text style={comunes.actoTitulo}>AUTORIZADO ELECTRÓNICAMENTE</Text>
          <Text style={comunes.actoTexto}>
            {acto.nombre} · RUN {acto.rut}
          </Text>
          <Text style={comunes.actoTexto}>
            {fechaHoraChile(acto.en)} · <Text style={comunes.actoCodigo}>{`${codigo}-${sufijo}`}</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export interface FirmasPostergacionPdf {
  solicitud?: string | null;
  jefatura?: string | null;
  aceptacion?: string | null;
}

export function PostergacionPdf({ p, firmas = {} }: { p: Postergacion; firmas?: FirmasPostergacionPdf }) {
  const proc = PROCESO_POSTERGACION;
  const d = p.ficha;
  const autoriza = p.firmaJefatura ? (p.estado === 'sin_postergacion' ? 'SI' : 'NO') : '';
  const acepta = p.firmaAceptacion ? (p.estado === 'completa' ? 'SI' : 'NO') : '';

  return (
    <Document title={`Postergación de feriado legal ${p.codigo}`} author="SLEP Aconcagua">
      <Page size="LETTER" style={comunes.pagina}>
        <View style={e.encabezado}>
          <Image style={e.logoIzq} src={LOGO_MINEDUC} />
          <Image style={e.logoDer} src={LOGO_ACONCAGUA} />
        </View>

        <Text style={e.titulo}>FORMULARIO POSTERGACIÓN DE FERIADO LEGAL PARA {proc.anioDestino}</Text>

        <View style={e.tabla}>
          <View style={e.fila}>
            <Text style={[e.etiqueta, e.etLarga]}>Nombre solicitante</Text>
            <View style={[e.valor, { flex: 1 }]}>
              <Text>{d.nombre}</Text>
            </View>
            <Text style={[e.etiqueta, e.etCorta]}>RUN</Text>
            <View style={[e.valor, { width: 95 }]}>
              <Text>{d.rutTexto}</Text>
            </View>
          </View>
          <View style={e.fila}>
            <Text style={[e.etiqueta, e.etLarga]}>Cargo solicitante</Text>
            <View style={[e.valor, { flex: 1 }]}>
              <Text>{d.cargo}</Text>
            </View>
            <Text style={[e.etiqueta, e.etCorta]}>Grado</Text>
            <View style={[e.valor, { width: 95 }]}>
              <Text>{d.grado}</Text>
            </View>
          </View>
          <View style={e.fila}>
            <Text style={[e.etiqueta, e.etLarga]}>Fecha solicitud</Text>
            <View style={[e.valor, { flex: 1 }]}>
              <Text>{fechaCorta(p.creadaEn.toISOString().slice(0, 10))}</Text>
            </View>
            <Text style={[e.etiqueta, e.etCorta]}>Estamento</Text>
            <View style={[e.valor, { width: 95 }]}>
              <Text>{d.estamento}</Text>
            </View>
          </View>
          <View style={e.fila}>
            <Text style={[e.etiqueta, e.etLarga]}>Unidad de dependencia</Text>
            <View style={[e.valor, { flex: 1 }]}>
              <Text>{d.unidad}</Text>
            </View>
          </View>
          <View style={e.filaUltima}>
            <Text style={[e.etiqueta, e.etLarga]}>Nombre de jefatura directa</Text>
            <View style={[e.valor, { flex: 1 }]}>
              <Text>{d.jefaturaNombre}</Text>
            </View>
          </View>
        </View>

        <Text style={e.seccion}>I.  SOLICITUD INICIAL DE FERIADO LEGAL (RELLENADO POR FUNCIONARIO).</Text>
        <View style={e.tabla}>
          <View style={e.fila}>
            <View style={{ flex: 1 }}>
              <View style={e.fila}>
                <Text style={[e.etiqueta, e.etLarga]}>Tipo de permiso</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>Feriado Legal</Text>
                </View>
              </View>
              <View style={e.fila}>
                <Text style={[e.etiqueta, e.etLarga]}>Fecha inicio</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>{p.fechaInicio ? fechaCorta(p.fechaInicio) : ' '}</Text>
                </View>
              </View>
              <View style={e.fila}>
                <Text style={[e.etiqueta, e.etLarga]}>Fecha término</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>{`31-12-${p.anio}`}</Text>
                </View>
              </View>
              <View style={e.filaUltima}>
                <Text style={[e.etiqueta, e.etLarga]}>N° días a solicitar</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>{f.numero(p.diasSolicitados)}</Text>
                </View>
              </View>
            </View>
            <Firma acto={p.firmaSolicitud} imagen={firmas.solicitud} pie="Firma funcionario(a)" sufijo="S1" codigo={p.codigo} />
          </View>
        </View>

        <Text style={e.seccion}>II.  AUTORIZACIÓN JEFATURA (RELLENADO POR JEFATURA).</Text>
        <View style={e.tabla}>
          <View style={e.fila}>
            <View style={{ flex: 1 }}>
              <View style={e.fila}>
                <Text style={[e.etiqueta, e.etLarga]}>¿Autoriza uso de feriado?</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>{autoriza || ' '}</Text>
                </View>
              </View>
              <Text style={e.declara}>
                Por razones de buen servicio, no se autoriza la solicitud de feriado legal y se propone postergar la época
                del feriado legal en los términos indicados en el artículo N°104 del DFL N°29, sobre Estatuto Administrativo.
              </Text>
            </View>
            <Firma acto={p.firmaJefatura} imagen={firmas.jefatura} pie="Firma jefatura" sufijo="J" codigo={p.codigo} />
          </View>
        </View>

        <Text style={e.seccion}>III.  SOLICITUD ACUMULACIÓN (RELLENADO POR FUNCIONARIO).</Text>
        <View style={e.tabla}>
          <View style={e.fila}>
            <View style={{ flex: 1 }}>
              <View style={e.fila}>
                <Text style={[e.etiqueta, e.etLarga]}>¿Acepta postergación propuesta por jefatura?</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>{acepta || ' '}</Text>
                </View>
              </View>
              <View style={e.fila}>
                <Text style={[e.etiqueta, e.etLarga]}>N° días que solicita acumular</Text>
                <View style={[e.valor, { flex: 1 }]}>
                  <Text>{p.diasAcumular === null ? ' ' : f.numero(p.diasAcumular)}</Text>
                </View>
              </View>
              <Text style={e.declara}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: AZUL }}>Declaración: </Text>
                Solicito autorización de acumulación de feriado legal correspondiente al año {p.anio}, a fin de hacer uso
                efectivo de él en forma conjunta con el del año {proc.anioDestino}, en consideración a que fue denegado por
                razones de buen servicio, en los términos indicados en el artículo N°104 del DFL N°29, sobre Estatuto
                Administrativo.
              </Text>
            </View>
            <Firma acto={p.firmaAceptacion} imagen={firmas.aceptacion} pie="Firma funcionario(a)" sufijo="S2" codigo={p.codigo} />
          </View>
        </View>

        {p.estado === 'completa' ? (
          <Text style={comunes.verificacion}>
            Documento generado por la plataforma Mis días del Servicio Local de Educación Pública Aconcagua. Su autenticidad
            puede verificarse en saldos-dias-slep-aconcagua.vercel.app/verificar con el código {p.codigo}. Cada firma se
            registró en el momento indicado y el documento no se modifica con posterioridad.
          </Text>
        ) : null}

        <Text style={e.pie}>
          Servicio Local de Educación Pública Aconcagua · Subdirección de Gestión y Desarrollo de Personas
        </Text>
      </Page>
    </Document>
  );
}
