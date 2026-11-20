import Image from 'next/image';
import logoInstitucional from '../../public/logos/slep-aconcagua-institucional.png';
import logoAconcagua from '../../public/logos/aconcagua.png';
import { fechaCorta, fechaHoraChile } from '@/lib/fechas';
import * as f from '@/lib/formato';
import { PROCESO_POSTERGACION } from '@/lib/postergacion';
import type { ActoFirma, Postergacion } from '@/lib/postergaciones';

export interface FirmasDocumento {
  solicitud?: string | null;
  jefatura?: string | null;
  aceptacion?: string | null;
}

/** Bloque de firma: la imagen cumple la formalidad, el registro de abajo es lo que prueba quién firmó. */
function Firma({ acto, imagen, pie, sufijo, codigo, filas }: { acto: ActoFirma | null; imagen?: string | null; pie: string; sufijo: string; codigo: string; filas: number }) {
  return (
    <td className="fp-firma" rowSpan={filas}>
      <span className="fp-linea">
        {acto && imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="" />
        ) : null}
      </span>
      <span className="fp-pie-firma">{pie}</span>
      {acto ? (
        <span className="fp-acto">
          <strong>AUTORIZADO ELECTRÓNICAMENTE</strong>
          {acto.nombre} · RUN {acto.rut}
          <br />
          {fechaHoraChile(acto.en)} · <span className="fp-codigo">{codigo}-{sufijo}</span>
        </span>
      ) : null}
    </td>
  );
}

export function DocumentoPostergacion({ p, firmas = {} }: { p: Postergacion; firmas?: FirmasDocumento }) {
  const proc = PROCESO_POSTERGACION;
  const d = p.ficha;
  const autorizaTexto = p.firmaJefatura ? (p.estado === 'sin_postergacion' ? 'SI' : 'NO') : '';
  const aceptaTexto = p.firmaAceptacion ? (p.estado === 'completa' ? 'SI' : 'NO') : '';
  const completo = p.estado === 'completa';

  return (
    <article className="fp-hoja" aria-label="Formulario de postergación de feriado legal">
      <header className="fp-encabezado">
        <Image className="fp-logo-izq" src={logoInstitucional} alt="Ministerio de Educación" />
        <Image className="fp-logo-der" src={logoAconcagua} alt="SLEP Aconcagua" />
      </header>

      <h2 className="fp-titulo">FORMULARIO POSTERGACIÓN DE FERIADO LEGAL PARA {proc.anioDestino}</h2>

      <table className="fp-tabla">
        <tbody>
          <tr>
            <th>Nombre solicitante</th>
            <td className="fp-dato">{d.nombre}</td>
            <th className="fp-corta">RUN</th>
            <td className="fp-dato">{d.rutTexto}</td>
          </tr>
          <tr>
            <th>Cargo solicitante</th>
            <td className="fp-dato">{d.cargo || ' '}</td>
            <th className="fp-corta">Grado</th>
            <td className="fp-dato">{d.grado || ' '}</td>
          </tr>
          <tr>
            <th>Fecha solicitud</th>
            <td className="fp-dato">{fechaCorta(p.creadaEn.toISOString().slice(0, 10))}</td>
            <th className="fp-corta">Estamento</th>
            <td className="fp-dato">{d.estamento || ' '}</td>
          </tr>
          <tr>
            <th>Unidad de dependencia</th>
            <td className="fp-dato" colSpan={3}>
              {d.unidad || ' '}
            </td>
          </tr>
          <tr>
            <th>Nombre de jefatura directa</th>
            <td className="fp-dato" colSpan={3}>
              {d.jefaturaNombre || ' '}
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="fp-seccion">
        I.&nbsp;&nbsp;SOLICITUD INICIAL DE FERIADO LEGAL (<i>RELLENADO POR FUNCIONARIO</i>).
      </h3>
      <table className="fp-tabla">
        <tbody>
          <tr>
            <th className="fp-larga">Tipo de permiso</th>
            <td className="fp-dato">Feriado Legal</td>
            <Firma acto={p.firmaSolicitud} imagen={firmas.solicitud} pie="Firma funcionario(a)" sufijo="S1" codigo={p.codigo} filas={4} />
          </tr>
          <tr>
            <th className="fp-larga">Fecha inicio</th>
            <td className="fp-dato">{p.fechaInicio ? fechaCorta(p.fechaInicio) : ' '}</td>
          </tr>
          <tr>
            <th className="fp-larga">Fecha término</th>
            <td className="fp-dato">{`31-12-${p.anio}`}</td>
          </tr>
          <tr>
            <th className="fp-larga">N° días a solicitar</th>
            <td className="fp-dato">{f.numero(p.diasSolicitados)}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="fp-seccion">
        II.&nbsp;&nbsp;AUTORIZACIÓN JEFATURA (<i>RELLENADO POR JEFATURA</i>).
      </h3>
      <table className="fp-tabla">
        <tbody>
          <tr>
            <th className="fp-larga">¿Autoriza uso de feriado?</th>
            <td className="fp-dato">{autorizaTexto || ' '}</td>
            <Firma acto={p.firmaJefatura} imagen={firmas.jefatura} pie="Firma jefatura" sufijo="J" codigo={p.codigo} filas={2} />
          </tr>
          <tr>
            <td className="fp-declara" colSpan={2}>
              Por razones de buen servicio, no se autoriza la solicitud de feriado legal y se propone postergar la época del
              feriado legal en los términos indicados en el artículo N°104 del DFL N°29, sobre Estatuto Administrativo.
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="fp-seccion">
        III.&nbsp;&nbsp;SOLICITUD ACUMULACIÓN (<i>RELLENADO POR FUNCIONARIO</i>).
      </h3>
      <table className="fp-tabla">
        <tbody>
          <tr>
            <th className="fp-larga">¿Acepta postergación propuesta por jefatura?</th>
            <td className="fp-dato">{aceptaTexto || ' '}</td>
            <Firma acto={p.firmaAceptacion} imagen={firmas.aceptacion} pie="Firma funcionario(a)" sufijo="S2" codigo={p.codigo} filas={3} />
          </tr>
          <tr>
            <th className="fp-larga">N° días que solicita acumular</th>
            <td className="fp-dato">{p.diasAcumular === null ? ' ' : f.numero(p.diasAcumular)}</td>
          </tr>
          <tr>
            <td className="fp-declara" colSpan={2}>
              <strong>Declaración:</strong> Solicito autorización de acumulación de feriado legal correspondiente al año{' '}
              {p.anio}, a fin de hacer uso efectivo de él en forma conjunta con el del año {proc.anioDestino}, en
              consideración a que fue denegado por razones de buen servicio, en los términos indicados en el artículo N°104
              del DFL N°29, sobre Estatuto Administrativo.
            </td>
          </tr>
        </tbody>
      </table>

      {completo ? (
        <p className="fp-verificacion">
          Documento generado por la plataforma <strong>Mis días</strong> del Servicio Local de Educación Pública Aconcagua.
          Su autenticidad puede verificarse en <strong>/verificar</strong> con el código <strong>{p.codigo}</strong>. Cada
          firma se registró en el momento indicado y el documento no se modifica con posterioridad.
        </p>
      ) : null}

      <footer className="fp-pie">
        Servicio Local de Educación Pública Aconcagua · Subdirección de Gestión y Desarrollo de Personas
      </footer>
    </article>
  );
}
