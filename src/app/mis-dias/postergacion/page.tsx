import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import logoInstitucional from '../../../../public/logos/slep-aconcagua-institucional.png';
import logoAconcagua from '../../../../public/logos/aconcagua.png';
import { Marco, CORREO_CONTACTO } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { fichaDe } from '@/lib/datos';
import { fechaCorta, hoyChile } from '@/lib/fechas';
import { feriadoPorVencer, feriadoPostergable } from '@/lib/feriado';
import { etapaPostergacion, PROCESO_POSTERGACION } from '@/lib/postergacion';
import * as f from '@/lib/formato';
import { formatearRut } from '@/lib/rut';
import { requerirUsuario } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Formulario de postergación' };

const ENLACES = [
  { href: '/mis-dias', texto: 'Mis días' },
  { href: '/cambiar-clave', texto: 'Cambiar contraseña' },
];

/** Redondea a medio día y deja el número dentro del máximo que se puede postergar. */
function diasPedidos(valor: string | undefined, maximo: number): number {
  const n = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return maximo;
  return Math.min(Math.round(n * 2) / 2, maximo);
}

/** Celda del formulario: muestra el dato o queda en blanco para escribirlo a mano. */
function Dato({ children }: { children?: string | null }) {
  return <td className="fp-dato">{children ? children : ' '}</td>;
}

export default async function FormularioPostergacion({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; desde?: string }>;
}) {
  const u = await requerirUsuario();
  if (u.rol === 'admin') redirect('/admin');

  const p = PROCESO_POSTERGACION;
  const ficha = await fichaDe(u.rut ?? '');
  const etapa = etapaPostergacion(hoyChile());
  const fl = ficha.dias?.feriadoLegal;
  const postergable = fl ? feriadoPostergable(fl) : 0;
  const porVencer = fl ? feriadoPorVencer(fl) : 0;

  const { dias: diasParam, desde } = await searchParams;
  const dias = diasPedidos(diasParam, postergable);

  const d = ficha.dotacion;
  const nombre = d?.nombre || ficha.dias?.nombre || u.nombre || '';
  const rutTexto = d?.rutTexto || ficha.dias?.rutTexto || (u.rut ? formatearRut(u.rut) : '');
  const unidad = d?.area || ficha.dias?.area || '';
  const baseDeOtroAnio = ficha.dias ? ficha.dias.anio !== p.anioAPostergar : false;

  const volver = (
    <p className="no-imprimir">
      <Link className="boton boton-secundario boton-chico" href="/mis-dias">
        Volver a Mis días
      </Link>
    </p>
  );

  if (!fl) {
    return (
      <Marco usuario={u} enlaces={ENLACES}>
        <div className="contenedor">
          <div className="seccion">
            <h1>Formulario de postergación de feriado legal</h1>
            <Alerta tipo="info" titulo="Todavía no hay información de tu feriado legal">
              <p>
                Gestión de Personas aún no ha cargado tus saldos, así que no se puede completar el formulario. Escribe a{' '}
                <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a> si necesitas postergar tus días.
              </p>
            </Alerta>
            {volver}
          </div>
        </div>
      </Marco>
    );
  }

  if (postergable <= 0) {
    return (
      <Marco usuario={u} enlaces={ENLACES}>
        <div className="contenedor">
          <div className="seccion">
            <h1>Formulario de postergación de feriado legal</h1>
            <Alerta tipo="info" titulo={`No tienes días de ${p.anioAPostergar} que postergar`}>
              <p>
                Solo se pueden postergar para {p.anioDestino} los días de feriado legal del año {p.anioAPostergar}, y hoy no te
                quedan días de ese año disponibles.
              </p>
              {porVencer > 0 ? (
                <p>
                  <strong>
                    Sí tienes {f.dias(porVencer)} acumulados de {p.anioAcumulado}, que no se pueden postergar otra vez: debes
                    tomarlos antes del 31 de diciembre para no perderlos.
                  </strong>
                </p>
              ) : null}
            </Alerta>
            {volver}
          </div>
        </div>
      </Marco>
    );
  }

  return (
    <Marco usuario={u} enlaces={ENLACES}>
      <div className="contenedor">
        <div className="seccion no-imprimir">
          <h1>Formulario de postergación de feriado legal</h1>
          <p className="texto-grande">
            El formulario sale con tus datos ya escritos. Revísalo, imprímelo, fírmalo junto a tu jefatura y envíalo a{' '}
            <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.
          </p>

          {etapa === null ? (
            <Alerta tipo="info" titulo="El proceso de postergación no está abierto">
              <p>
                El plazo para solicitar la postergación es entre el {fechaCorta(p.inicio)} y el {fechaCorta(p.fin)}. Puedes
                revisar el formulario igual, pero fuera de esas fechas no se recibe.
              </p>
            </Alerta>
          ) : null}

          {baseDeOtroAnio ? (
            <Alerta tipo="advertencia" titulo="Tus saldos son de otro año">
              <p>
                La información cargada corresponde al año {ficha.dias?.anio} y este formulario posterga días de{' '}
                {p.anioAPostergar}. Revisa las cantidades antes de firmar y consulta con Gestión de Personas si no cuadran.
              </p>
            </Alerta>
          ) : null}

          <Alerta tipo="info" titulo={`Puedes postergar hasta ${f.dias(postergable)}`}>
            <p>
              Es el feriado legal del año {p.anioAPostergar} que te queda disponible. Tu saldo total es de {f.dias(fl.saldo)}.
            </p>
            {porVencer > 0 ? (
              <p>
                <strong>
                  Los {f.dias(porVencer)} acumulados de {p.anioAcumulado} no entran en la postergación y debes tomarlos antes
                  del 31 de diciembre para no perderlos.
                </strong>
              </p>
            ) : null}
          </Alerta>

          <form method="get" className="fp-controles">
            <div className="campo">
              <label htmlFor="dias">N° de días que quieres postergar</label>
              <input
                id="dias"
                name="dias"
                type="number"
                min="0.5"
                max={postergable}
                step="0.5"
                defaultValue={dias}
                required
              />
              <span className="sub">Máximo {f.dias(postergable)}.</span>
            </div>
            <div className="campo">
              <label htmlFor="desde">Fecha de inicio que pides en la sección I</label>
              <input id="desde" name="desde" type="date" defaultValue={desde ?? ''} max={`${p.anioAPostergar}-12-31`} />
              <span className="sub">Si la dejas en blanco, la escribes a mano.</span>
            </div>
            <div className="campo fp-boton">
              <button className="boton boton-secundario" type="submit">
                Actualizar formulario
              </button>
            </div>
          </form>

          <p className="sub">
            Para guardarlo como PDF, imprime la página y elige &laquo;Guardar como PDF&raquo; en el destino de impresión.
          </p>
        </div>

        <article className="fp-hoja" aria-label="Formulario de postergación de feriado legal">
          <header className="fp-encabezado">
            <Image className="fp-logo-izq" src={logoInstitucional} alt="Ministerio de Educación" />
            <Image className="fp-logo-der" src={logoAconcagua} alt="SLEP Aconcagua" />
          </header>

          <h2 className="fp-titulo">FORMULARIO POSTERGACIÓN DE FERIADO LEGAL PARA {p.anioDestino}</h2>

          <table className="fp-tabla">
            <tbody>
              <tr>
                <th>Nombre solicitante</th>
                <Dato>{nombre}</Dato>
                <th className="fp-corta">RUN</th>
                <Dato>{rutTexto}</Dato>
              </tr>
              <tr>
                <th>Cargo solicitante</th>
                <Dato>{d?.cargo}</Dato>
                <th className="fp-corta">Grado</th>
                <Dato>{d?.grado}</Dato>
              </tr>
              <tr>
                <th>Fecha solicitud</th>
                <Dato>{fechaCorta(hoyChile())}</Dato>
                <th className="fp-corta">Estamento</th>
                <Dato>{d?.estamento}</Dato>
              </tr>
              <tr>
                <th>Unidad de dependencia</th>
                <td className="fp-dato" colSpan={3}>
                  {unidad || ' '}
                </td>
              </tr>
              <tr>
                <th>Nombre de jefatura directa</th>
                <td className="fp-dato" colSpan={3}>
                  {d?.jefatura || ' '}
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
                <Dato>Feriado Legal</Dato>
                <td className="fp-firma" rowSpan={4}>
                  <span className="fp-linea" />
                  <span className="fp-pie-firma">Firma funcionario(a)</span>
                </td>
              </tr>
              <tr>
                <th className="fp-larga">Fecha inicio</th>
                <Dato>{desde ? fechaCorta(desde) : null}</Dato>
              </tr>
              <tr>
                <th className="fp-larga">Fecha término</th>
                <Dato>{`31/12/${p.anioAPostergar}`}</Dato>
              </tr>
              <tr>
                <th className="fp-larga">N° días a solicitar</th>
                <Dato>{f.numero(dias)}</Dato>
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
                <Dato>NO</Dato>
                <td className="fp-firma" rowSpan={2}>
                  <span className="fp-linea" />
                  <span className="fp-pie-firma">Firma jefatura</span>
                </td>
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
                <Dato>SI</Dato>
                <td className="fp-firma" rowSpan={3}>
                  <span className="fp-linea" />
                  <span className="fp-pie-firma">Firma funcionario(a)</span>
                </td>
              </tr>
              <tr>
                <th className="fp-larga">N° días que solicita acumular</th>
                <Dato>{f.numero(dias)}</Dato>
              </tr>
              <tr>
                <td className="fp-declara" colSpan={2}>
                  <strong>Declaración:</strong> Solicito autorización de acumulación de feriado legal correspondiente al año{' '}
                  {p.anioAPostergar}, a fin de hacer uso efectivo de él en forma conjunta con el del año {p.anioDestino}, en
                  consideración a que fue denegado por razones de buen servicio, en los términos indicados en el artículo N°104
                  del DFL N°29, sobre Estatuto Administrativo.
                </td>
              </tr>
            </tbody>
          </table>

          <footer className="fp-pie">
            Servicio Local de Educación Pública Aconcagua · Subdirección de Gestión y Desarrollo de Personas
          </footer>
        </article>

        <div className="seccion no-imprimir">{volver}</div>
      </div>
    </Marco>
  );
}
