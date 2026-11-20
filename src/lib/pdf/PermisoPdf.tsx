import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { fechaCorta, fechaHoraChile } from '../fechas.ts';
import * as f from '../formato.ts';
import type { Permiso } from '../permisos.ts';
import type { ActoFirma } from '../postergaciones.ts';
import { CAUSALES_OTROS, esNoHabil, horasTexto, jornadaUnica, totalRecuperado } from '../reglasPermisos.ts';
import { AZUL, AZUL_CLARO, comunes } from './estilos.ts';
import { LOGO_ACONCAGUA, LOGO_MINEDUC } from './logos.ts';

/** Réplica en PDF del "Formulario Solicitud de Permisos" del SLEP Aconcagua. */

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoIzq: { width: 46 },
  titulo: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Helvetica-BoldOblique', color: AZUL_CLARO },
  logoDer: { width: 110 },

  caja: { borderWidth: 1.2, borderColor: AZUL, borderRadius: 9 },
  idFila: { flexDirection: 'row', borderBottomWidth: 0.9, borderBottomColor: AZUL },
  idUltima: { flexDirection: 'row' },
  idCelda: { flex: 1, flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 8 },
  idCeldaBorde: { borderLeftWidth: 0.9, borderLeftColor: AZUL },
  k: { color: AZUL, fontFamily: 'Helvetica-Bold', marginRight: 4 },
  v: { fontFamily: 'Helvetica-Bold', flex: 1 },

  seccion: { fontSize: 10.5, fontFamily: 'Helvetica-BoldOblique', color: AZUL_CLARO, marginTop: 10 },
  subSeccion: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: AZUL_CLARO, marginBottom: 4 },

  columnas: { flexDirection: 'row', marginBottom: 8 },
  colIzq: { flex: 52, marginRight: 10 },
  colDer: { flex: 44 },
  lista: { paddingVertical: 6, paddingHorizontal: 9 },
  opcion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  chk: { width: 9, height: 9, borderWidth: 1, borderColor: AZUL, borderRadius: 2, marginRight: 5, alignItems: 'center', justifyContent: 'center' },
  chkX: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: AZUL, lineHeight: 1 },
  otrosTitulo: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL, textAlign: 'center', marginBottom: 3 },
  otrosGrid: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 9 },
  notaCert: { fontSize: 6.8, fontFamily: 'Helvetica-Oblique', color: AZUL, marginTop: 3 },

  tres: { flexDirection: 'row', marginBottom: 6 },
  cajaTres: { flex: 1, borderWidth: 1.2, borderColor: AZUL, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center' },
  ranura: { borderWidth: 1, borderColor: AZUL, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 6, marginRight: 6, fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center' },
  ranuraCorta: { minWidth: 30 },
  ranuraAncha: { minWidth: 62 },
  detalle: { fontSize: 7, marginBottom: 7, lineHeight: 1.4 },

  jornada: { flexDirection: 'row', width: '66%', paddingVertical: 6, paddingHorizontal: 11, marginBottom: 7 },
  aprueba: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5 },
  // El triángulo del formulario: Helvetica no trae ese carácter, así que se dibuja.
  triangulo: { width: 0, height: 0, borderTopWidth: 3.5, borderBottomWidth: 3.5, borderLeftWidth: 6,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: AZUL, marginRight: 4, marginBottom: 2 },
  apruebaLab: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL, marginRight: 8 },
  siNo: { alignItems: 'center', marginRight: 8 },
  siNoTexto: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: AZUL, marginBottom: 1 },

  firmas: { flexDirection: 'row', borderWidth: 1.2, borderColor: AZUL, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12, minHeight: 86 },
  mitad: { flex: 1 },
  mitadDer: { borderLeftWidth: 0.6, borderLeftColor: '#b9cbda', paddingLeft: 12, marginLeft: 12 },
  firmaImg: { height: 34, marginBottom: 2, objectFit: 'contain', alignSelf: 'flex-start' },
  sinFirma: { height: 34, fontSize: 7.5, fontFamily: 'Helvetica-Oblique', color: '#98a6b2', paddingTop: 12 },
  firmaPie: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL, marginTop: 4 },

  pie: { flexDirection: 'row', height: 12, marginTop: 10, marginHorizontal: -34 },
  barra: { flex: 1, backgroundColor: AZUL },
  marcas: { flexDirection: 'row', backgroundColor: AZUL, paddingRight: 3 },
  marca: { width: 5, backgroundColor: '#ffffff', marginLeft: 3 },
});

function Casilla({ marcada }: { marcada: boolean }) {
  return <View style={e.chk}>{marcada ? <Text style={e.chkX}>X</Text> : null}</View>;
}

function Opcion({ texto, marcada }: { texto: string; marcada: boolean }) {
  return (
    <View style={e.opcion}>
      <Casilla marcada={marcada} />
      <Text>{texto}</Text>
    </View>
  );
}

function Firma({ acto, imagen, pie, sufijo, codigo, derecha }: { acto: ActoFirma | null; imagen?: string | null; pie: string; sufijo: string; codigo: string; derecha?: boolean }) {
  return (
    <View style={derecha ? [e.mitad, e.mitadDer] : e.mitad}>
      {acto && imagen ? <Image style={e.firmaImg} src={imagen} /> : <Text style={e.sinFirma}>sin firmar</Text>}
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
      <Text style={e.firmaPie}>{pie}</Text>
    </View>
  );
}

export interface FirmasPdf {
  solicitud?: string | null;
  jefatura?: string | null;
}

export function PermisoPdf({ p, firmas = {} }: { p: Permiso; firmas?: FirmasPdf }) {
  const habiles = p.dias.filter((d) => !esNoHabil(d.fecha));
  const primera = habiles[0]?.fecha ?? p.dias[0]?.fecha ?? null;
  const ultima = habiles[habiles.length - 1]?.fecha ?? p.dias[p.dias.length - 1]?.fecha ?? null;
  const porHoras = p.tipo === 'compensatorio';
  const jornada = p.tipo === 'goce' ? jornadaUnica(p.dias) : null;
  const mezclada = p.tipo === 'goce' && jornada === null && habiles.length > 1;
  const r = p.tipo === 'interferiado' ? p.recuperacion : null;
  const resuelto = p.estado !== 'pendiente_jefatura';

  const horasTotales = porHoras ? horasTexto(p.totalMinutos) : r ? String(totalRecuperado(r.dias)) : '—';

  return (
    <Document title={`Solicitud de permiso ${p.codigo}`} author="SLEP Aconcagua">
      <Page size="LETTER" style={comunes.pagina}>
        <View style={e.encabezado}>
          <Image style={e.logoIzq} src={LOGO_MINEDUC} />
          <Text style={e.titulo}>FORMULARIO SOLICITUD DE PERMISOS</Text>
          <Image style={e.logoDer} src={LOGO_ACONCAGUA} />
        </View>

        <View style={e.caja}>
          <View style={e.idFila}>
            <View style={e.idCelda}>
              <Text style={e.k}>Nombre Solicitante:</Text>
              <Text style={e.v}>{p.ficha.nombre}</Text>
            </View>
            <View style={[e.idCelda, e.idCeldaBorde]}>
              <Text style={e.k}>RUN:</Text>
              <Text style={e.v}>{p.ficha.rutTexto}</Text>
            </View>
          </View>
          <View style={e.idFila}>
            <View style={e.idCelda}>
              <Text style={e.k}>Cargo Solicitante:</Text>
              <Text style={e.v}>{p.ficha.cargo}</Text>
            </View>
            <View style={[e.idCelda, e.idCeldaBorde]}>
              <Text style={e.k}>Grado:</Text>
              <Text style={e.v}>{p.ficha.grado}</Text>
            </View>
          </View>
          <View style={e.idFila}>
            <View style={e.idCelda}>
              <Text style={e.k}>Fecha Solicitud:</Text>
              <Text style={e.v}>{fechaCorta(p.creadaEn.toISOString().slice(0, 10))}</Text>
            </View>
            <View style={[e.idCelda, e.idCeldaBorde]}>
              <Text style={e.k}>Estamento:</Text>
              <Text style={e.v}>{p.ficha.estamento}</Text>
            </View>
          </View>
          <View style={e.idFila}>
            <View style={e.idCelda}>
              <Text style={e.k}>Unidad de Dependencia:</Text>
              <Text style={e.v}>{p.ficha.unidad}</Text>
            </View>
          </View>
          <View style={e.idUltima}>
            <View style={e.idCelda}>
              <Text style={e.k}>Nombre de Jefatura:</Text>
              <Text style={e.v}>{p.ficha.jefaturaNombre}</Text>
            </View>
          </View>
        </View>

        <View style={e.columnas}>
          <View style={e.colIzq}>
            <Text style={e.seccion}>PERMISO POR SOLICITAR</Text>
            <Text style={e.subSeccion}>(marcar casilla con una x)</Text>
            <View style={[e.caja, e.lista]}>
              <Opcion texto="Feriado Legal" marcada={p.tipo === 'feriado'} />
              <Opcion texto="Con goce de remuneraciones" marcada={p.tipo === 'goce'} />
              <Opcion texto="Descanso Compensatorio" marcada={p.tipo === 'compensatorio'} />
              <Opcion texto="Interferiado (horas por recuperar)" marcada={p.tipo === 'interferiado'} />
            </View>
          </View>
          <View style={e.colDer}>
            <Text style={e.otrosTitulo}>Otros Permisos</Text>
            <View style={[e.caja, e.otrosGrid]}>
              {[CAUSALES_OTROS.slice(0, 3), CAUSALES_OTROS.slice(3)].map((grupo, i) => (
                <View key={i} style={{ flex: 1 }}>
                  {grupo.map((c) => (
                    <Opcion
                      key={c}
                      texto={c === 'Otros' ? `Otros ${p.causal === 'Otros' && p.detalle ? p.detalle : '______'}` : c}
                      marcada={p.tipo === 'otros' && p.causal === c}
                    />
                  ))}
                </View>
              ))}
            </View>
            <Text style={e.notaCert}>*Adjuntar certificado correspondiente</Text>
          </View>
        </View>

        <Text style={e.seccion}>DÍAS A SOLICITAR</Text>
        <Text style={e.subSeccion}>(rellenar casilla)</Text>
        <View style={e.tres}>
          <View style={[e.cajaTres, { marginRight: 10 }]}>
            <Text style={[e.ranura, e.ranuraCorta]}>{porHoras ? '—' : f.numero(p.totalDias)}</Text>
            <Text>N Total de días</Text>
          </View>
          <View style={[e.cajaTres, { marginRight: 10 }]}>
            <Text style={[e.ranura, e.ranuraAncha]}>{porHoras || !primera ? '—' : fechaCorta(primera)}</Text>
            <Text>Desde</Text>
          </View>
          <View style={e.cajaTres}>
            <Text style={[e.ranura, e.ranuraAncha]}>{porHoras || !ultima ? '—' : fechaCorta(ultima)}</Text>
            <Text>Hasta</Text>
          </View>
        </View>

        {mezclada ? (
          <Text style={e.detalle}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: AZUL }}>Detalle por día: </Text>
            {habiles
              .map((d) => `${fechaCorta(d.fecha)} ${d.jornada === 'completa' ? 'jornada completa' : d.jornada === 'am' ? '1/2 día AM' : '1/2 día PM'}`)
              .join(' · ')}
          </Text>
        ) : null}
        {porHoras && primera ? (
          <Text style={e.detalle}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: AZUL }}>Fecha del descanso compensatorio: </Text>
            {fechaCorta(primera)}
          </Text>
        ) : null}

        <Text style={e.seccion}>TIPO DE JORNADA (sólo día administrativo)</Text>
        <Text style={e.subSeccion}>(marcar casilla con una x)</Text>
        <View style={[e.caja, e.jornada]}>
          <View style={{ flex: 1 }}>
            <Opcion texto="Completa" marcada={jornada === 'completa'} />
          </View>
          <View style={{ flex: 1 }}>
            <Opcion texto="1/2 Día AM" marcada={jornada === 'am'} />
          </View>
          <View style={{ flex: 1 }}>
            <Opcion texto="1/2 Día PM" marcada={jornada === 'pm'} />
          </View>
        </View>

        <Text style={e.seccion}>HORAS POR SOLICITAR</Text>
        <Text style={e.subSeccion}>(rellenar casilla)</Text>
        <View style={e.tres}>
          <View style={[e.cajaTres, { marginRight: 10 }]}>
            <Text style={[e.ranura, e.ranuraCorta]}>{horasTotales}</Text>
            <Text>N° Total de horas</Text>
          </View>
          <View style={[e.cajaTres, { marginRight: 10 }]}>
            <Text style={[e.ranura, e.ranuraAncha]}>{porHoras ? (p.horaDesde ?? '—') : '—'}</Text>
            <Text>Desde</Text>
          </View>
          <View style={e.cajaTres}>
            <Text style={[e.ranura, e.ranuraAncha]}>{porHoras ? (p.horaHasta ?? '—') : '—'}</Text>
            <Text>Hasta</Text>
          </View>
        </View>

        {r && r.dias.length ? (
          <Text style={e.detalle}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: AZUL }}>Horas por recuperar: </Text>
            {`${totalRecuperado(r.dias)} horas, ${r.horasPorDia} h extra por día, en ${r.dias.map((d) => fechaCorta(d.fecha)).join(' · ')}`}
          </Text>
        ) : null}

        <View style={e.aprueba}>
          <View style={e.triangulo} />
          <Text style={e.apruebaLab}>Jefatura aprueba permiso</Text>
          <View style={e.siNo}>
            <Text style={e.siNoTexto}>Sí</Text>
            <Casilla marcada={p.estado === 'autorizado'} />
          </View>
          <View style={e.siNo}>
            <Text style={e.siNoTexto}>No</Text>
            <Casilla marcada={p.estado === 'rechazado'} />
          </View>
        </View>

        <View style={e.firmas}>
          <Firma acto={p.firmaSolicitud} imagen={firmas.solicitud} pie="Firma" sufijo="S" codigo={p.codigo} />
          <Firma acto={p.firmaJefatura} imagen={firmas.jefatura} pie="Nombre y Firma Jefatura" sufijo="J" codigo={p.codigo} derecha />
        </View>

        {resuelto ? (
          <Text style={comunes.verificacion}>
            Documento generado por la plataforma Mis días del Servicio Local de Educación Pública Aconcagua. Su autenticidad
            puede verificarse en saldos-dias-slep-aconcagua.vercel.app/verificar con el código {p.codigo}. Cada firma se
            registró en el momento indicado y el documento no se modifica con posterioridad.
          </Text>
        ) : null}

        <View style={e.pie} fixed>
          <View style={e.barra} />
          <View style={e.marcas}>
            {Array.from({ length: 10 }, (_, i) => (
              <View key={i} style={e.marca} />
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
