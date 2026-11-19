import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { DocumentoPostergacion } from '@/componentes/DocumentoPostergacion';
import { FormularioAceptacion, FormularioSolicitud } from '@/componentes/PasosPostergacion';
import { fichaDe } from '@/lib/datos';
import { fechaCorta, hoyChile } from '@/lib/fechas';
import { feriadoPorVencer, feriadoPostergable } from '@/lib/feriado';
import { firmaDe, firmaPorRut } from '@/lib/firmas';
import { jefaturaDe } from '@/lib/jefaturas';
import { etapaPostergacion, PROCESO_POSTERGACION } from '@/lib/postergacion';
import { solicitudDe } from '@/lib/postergaciones';
import * as f from '@/lib/formato';
import { enlacesDe } from '@/lib/enlaces';
import { requerirUsuario } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Postergar mi feriado legal' };


/** Los tres pasos del trámite, para que se vea dónde va cada solicitud. */
function Ruta({ paso }: { paso: 1 | 2 | 3 | 4 }) {
  const pasos = ['Solicitas tu feriado', 'Responde tu jefatura', 'Aceptas la postergación', 'Queda registrada'];
  return (
    <ol className="ruta-pasos">
      {pasos.map((t, i) => (
        <li key={t} className={i + 1 < paso ? 'listo' : i + 1 === paso ? 'actual' : ''}>
          <span className="ruta-punto" aria-hidden="true" />
          {t}
        </li>
      ))}
    </ol>
  );
}

export default async function Postergacion() {
  const u = await requerirUsuario();
  if (u.rol === 'admin') redirect('/admin');

  const proc = PROCESO_POSTERGACION;
  const etapa = etapaPostergacion(hoyChile());
  const [ficha, solicitud, miFirma, enlaces] = await Promise.all([
    fichaDe(u.rut ?? ''),
    solicitudDe(u.rut ?? ''),
    firmaDe(u.id),
    enlacesDe(u.rut),
  ]);
  const fl = ficha.dias?.feriadoLegal;
  const postergable = fl ? feriadoPostergable(fl) : 0;
  const porVencer = fl ? feriadoPorVencer(fl) : 0;

  const marco = (contenido: React.ReactNode) => (
    <Marco usuario={u} enlaces={enlaces}>
      <div className="contenedor">
        <div className="seccion">
          <h1>Postergar mi feriado legal para {proc.anioDestino}</h1>
          {contenido}
          <p style={{ marginTop: 24 }}>
            <Link className="boton boton-secundario boton-chico" href="/mis-dias">
              Volver a Mis días
            </Link>
          </p>
        </div>
      </div>
    </Marco>
  );

  // ---- El documento, cuando ya hay una solicitud ----
  if (solicitud) {
    const [firmaJefatura] = await Promise.all([firmaPorRut(solicitud.jefaturaRut)]);
    const firmas = {
      solicitud: miFirma,
      jefatura: firmaJefatura,
      aceptacion: solicitud.firmaAceptacion ? miFirma : null,
    };
    const paso = solicitud.estado === 'pendiente_jefatura' ? 2 : solicitud.estado === 'pendiente_funcionario' ? 3 : 4;

    const estadoAviso = {
      pendiente_jefatura: (
        <Alerta tipo="info" titulo="Tu solicitud está con tu jefatura">
          <p>
            Firmaste la sección I y tu jefatura, {solicitud.ficha.jefaturaNombre}, tiene que responderla. Cuando lo haga,
            vuelve aquí para aceptar la postergación y firmar la sección III.
          </p>
        </Alerta>
      ),
      pendiente_funcionario: (
        <Alerta tipo="advertencia" titulo="Te toca a ti: acepta la postergación y firma">
          <p>
            Tu jefatura denegó el feriado por razones de buen servicio y propuso postergarlo. Falta que aceptes y declares
            cuántos días acumulas para {proc.anioDestino}.
          </p>
        </Alerta>
      ),
      completa: (
        <Alerta tipo="exito" titulo="Listo, tu postergación quedó registrada">
          <p>
            Solicitaste acumular {f.dias(solicitud.diasAcumular ?? 0)} para {proc.anioDestino}. El documento de abajo es tu
            respaldo y se puede verificar con el código {solicitud.codigo}.
          </p>
        </Alerta>
      ),
      sin_postergacion: (
        <Alerta tipo="info" titulo="Tu jefatura autorizó el feriado">
          <p>No hay postergación que tramitar: puedes tomar tus días dentro del año.</p>
        </Alerta>
      ),
      desistida: (
        <Alerta tipo="info" titulo="Desististe de la postergación">
          <p>Tus días pendientes tienen que usarse antes del 31 de diciembre de {solicitud.anio}.</p>
        </Alerta>
      ),
    }[solicitud.estado];

    return marco(
      <>
        <Ruta paso={paso as 1 | 2 | 3 | 4} />
        {estadoAviso}

        {solicitud.estado === 'pendiente_funcionario' ? (
          <section className="tarjeta" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Sección III: solicitud de acumulación</h2>
            {!miFirma ? (
              <Alerta tipo="advertencia" titulo="Primero guarda tu firma">
                <p>
                  Necesitas tu firma para completar esta sección. <Link href="/mi-firma">Guárdala en Mi firma</Link> y
                  vuelve.
                </p>
              </Alerta>
            ) : (
              <FormularioAceptacion
                postergable={postergable}
                maximoSolicitado={solicitud.diasSolicitados}
                anio={solicitud.anio}
                anioDestino={proc.anioDestino}
              />
            )}
          </section>
        ) : null}

        <h2>Tu formulario</h2>
        <DocumentoPostergacion p={solicitud} firmas={firmas} />
      </>,
    );
  }

  // ---- Todavía no hay solicitud ----
  if (!fl) {
    return marco(
      <Alerta tipo="info" titulo="Todavía no hay información de tu feriado legal">
        <p>Gestión de Personas aún no ha cargado tus saldos, así que no se puede iniciar el trámite.</p>
      </Alerta>,
    );
  }

  if (etapa !== 'abierto') {
    return marco(
      <Alerta tipo="info" titulo="El proceso de postergación no está abierto">
        <p>
          El plazo para solicitar la postergación es entre el {fechaCorta(proc.inicio)} y el {fechaCorta(proc.fin)}.
        </p>
      </Alerta>,
    );
  }

  if (postergable <= 0) {
    return marco(
      <Alerta tipo="info" titulo={`No tienes días de ${proc.anioAPostergar} que postergar`}>
        <p>
          Solo se pueden postergar para {proc.anioDestino} los días de feriado legal del año {proc.anioAPostergar}, y hoy no
          te quedan días de ese año disponibles.
        </p>
        {porVencer > 0 ? (
          <p>
            <strong>
              Sí tienes {f.dias(porVencer)} acumulados de años anteriores, que no se pueden postergar otra vez: tómalos
              antes del 31 de diciembre para no perderlos.
            </strong>
          </p>
        ) : null}
      </Alerta>,
    );
  }

  const jefatura = await jefaturaDe(u.rut ?? '');

  return marco(
    <>
      <Ruta paso={1} />

      <section className="tarjeta" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Cómo funciona este trámite</h2>
        <ol className="lista-pasos">
          <li>
            <strong>Tú pides tu feriado</strong> hasta el 31 de diciembre de {proc.anioAPostergar} y firmas la sección I.
            Este paso es obligatorio aunque quieras postergar, porque la acumulación del artículo N°104 solo procede si el
            feriado fue denegado por razones de buen servicio.
          </li>
          <li>
            <strong>Tu jefatura responde</strong> y firma la sección II. Si deniega el feriado por buen servicio, propone
            postergarlo.
          </li>
          <li>
            <strong>Vuelve a ti:</strong> aceptas la postergación, declaras cuántos días acumulas para {proc.anioDestino} y
            firmas la sección III.
          </li>
          <li>
            <strong>Queda registrada</strong> con un código de verificación. No tienes que imprimir, firmar en papel ni
            enviar nada por correo: todo el trámite ocurre aquí.
          </li>
        </ol>
      </section>

      <div className="grilla grilla-2" style={{ marginBottom: 20 }}>
        <div className="tarjeta">
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Puedes postergar</h3>
          <p className="saldo-cifra" style={{ margin: 0 }}>
            {f.numero(postergable)}
            <small>días</small>
          </p>
          <p className="sub" style={{ marginBottom: 0 }}>
            Son los del año {proc.anioAPostergar}. Tu saldo total de feriado legal es de {f.dias(fl.saldo)}.
          </p>
        </div>
        <div className="tarjeta">
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>No se pueden postergar</h3>
          <p className="saldo-cifra" style={{ margin: 0 }}>
            {f.numero(porVencer)}
            <small>días</small>
          </p>
          <p className="sub" style={{ marginBottom: 0 }}>
            Vienen de años anteriores. Tómalos antes del 31 de diciembre para no perderlos.
          </p>
        </div>
      </div>

      {!miFirma ? (
        <Alerta tipo="advertencia" titulo="Primero guarda tu firma">
          <p>
            Para firmar las secciones I y III necesitas tener tu firma guardada.{' '}
            <Link href="/mi-firma">Guárdala en Mi firma</Link> y vuelve a esta página.
          </p>
        </Alerta>
      ) : !jefatura ? (
        <Alerta tipo="error" titulo="No pude identificar a tu jefatura">
          <p>
            En la Dotación tu jefatura aparece como &laquo;{ficha.dotacion?.jefatura || 'sin dato'}&raquo;, y no logré
            emparejarla con una persona. Avísale a Gestión de Personas para que la asigne y vuelve a intentar.
          </p>
        </Alerta>
      ) : (
        <section className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Sección I: solicitud inicial de feriado legal</h2>
          <p className="sub">
            Tu solicitud la responderá <strong>{jefatura.nombre}</strong>.
          </p>
          <FormularioSolicitud postergable={postergable} porVencer={porVencer} anio={proc.anioAPostergar} />
        </section>
      )}
    </>,
  );
}
