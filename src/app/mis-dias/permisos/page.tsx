import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { DocumentoPermiso } from '@/componentes/DocumentoPermiso';
import { SolicitarPermiso } from '@/componentes/SolicitarPermiso';
import { fichaDe } from '@/lib/datos';
import { enlacesDe } from '@/lib/enlaces';
import { fechaHoraChile, hoyChile } from '@/lib/fechas';
import { firmaDe, firmaPorRut } from '@/lib/firmas';
import { jefaturaDe } from '@/lib/jefaturas';
import { permisosDe, saldosDisponibles, TEXTO_ESTADO_PERMISO } from '@/lib/permisos';
import { horasTexto, nombreTipo } from '@/lib/reglasPermisos';
import * as f from '@/lib/formato';
import { requerirUsuario } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Mis permisos' };

const ETIQUETA = {
  pendiente_jefatura: 'etiqueta-advertencia',
  autorizado: 'etiqueta-exito',
  rechazado: 'etiqueta-neutra',
} as const;

export default async function Permisos({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const u = await requerirUsuario();
  if (u.rol === 'admin') redirect('/admin');

  const [ficha, mios, miFirma, jefatura, enlaces, disponible] = await Promise.all([
    fichaDe(u.rut ?? ''),
    permisosDe(u.rut ?? ''),
    firmaDe(u.id),
    jefaturaDe(u.rut ?? ''),
    enlacesDe(u.rut),
    saldosDisponibles(u.rut ?? ''),
  ]);
  const { saldos, descontado } = disponible;

  const { codigo } = await searchParams;
  const abierto = codigo ? mios.find((p) => p.codigo === codigo.toUpperCase()) : null;
  const firmaJefatura = abierto ? await firmaPorRut(abierto.jefaturaRut) : null;

  return (
    <Marco usuario={u} enlaces={enlaces}>
      <div className="contenedor">
        <div className="seccion">
          <h1>Mis permisos</h1>
          <p className="texto-grande">
            Solicita aquí tus permisos. Tu jefatura los autoriza en la plataforma y el formulario queda firmado por las
            dos partes, sin imprimir nada.
          </p>

          {abierto ? (
            <>
              <p>
                <Link className="boton boton-secundario boton-chico" href="/mis-dias/permisos">
                  Volver a mis permisos
                </Link>
              </p>
              <DocumentoPermiso p={abierto} firmas={{ solicitud: miFirma, jefatura: firmaJefatura }} />
            </>
          ) : (
            <>
              <div className="grilla grilla-3" style={{ marginBottom: 20 }}>
                <div className="tarjeta">
                  <h3 style={{ marginTop: 0, marginBottom: 4 }}>Feriado legal</h3>
                  <p className="saldo-cifra" style={{ margin: 0 }}>
                    {f.numero(saldos.feriado)}
                    <small>días</small>
                  </p>
                </div>
                <div className="tarjeta">
                  <h3 style={{ marginTop: 0, marginBottom: 4 }}>Con goce de remuneraciones</h3>
                  <p className="saldo-cifra" style={{ margin: 0 }}>
                    {f.numero(saldos.goce)}
                    <small>días</small>
                  </p>
                </div>
                <div className="tarjeta">
                  <h3 style={{ marginTop: 0, marginBottom: 4 }}>Descanso compensatorio</h3>
                  <p className="saldo-cifra" style={{ margin: 0 }}>
                    {horasTexto(saldos.compensatorioMin)}
                    <small>hrs</small>
                  </p>
                </div>
              </div>

              {descontado ? (
                <Alerta tipo="info" titulo="Estos saldos ya descuentan lo que pediste aquí">
                  <p>
                    Las planillas de Gestión de Personas se suben cada cierto tiempo, así que a tu saldo le restamos los
                    permisos que pediste en la plataforma después de la última carga. Así no puedes pedir dos veces los
                    mismos días.
                  </p>
                </Alerta>
              ) : null}

              {!miFirma ? (
                <Alerta tipo="advertencia" titulo="Primero guarda tu firma">
                  <p>
                    Para firmar tus solicitudes necesitas tener tu firma guardada.{' '}
                    <Link href="/mi-firma">Guárdala en Mi firma</Link> y vuelve a esta página.
                  </p>
                </Alerta>
              ) : !jefatura ? (
                <Alerta tipo="error" titulo="No pude identificar a tu jefatura">
                  <p>
                    En la Dotación tu jefatura aparece como &laquo;{ficha.dotacion?.jefatura || 'sin dato'}&raquo;, y no
                    logré emparejarla con una persona. Avísale a Gestión de Personas para que la asigne.
                  </p>
                </Alerta>
              ) : (
                <section className="tarjeta" style={{ marginBottom: 24 }}>
                  <h2 style={{ marginTop: 0 }}>Solicitar un permiso</h2>
                  <p className="sub">
                    Lo va a responder <strong>{jefatura.nombre}</strong>.
                  </p>
                  <SolicitarPermiso saldos={saldos} jefaturaNombre={jefatura.nombre} hoy={hoyChile()} />
                </section>
              )}

              <h2>Mis solicitudes</h2>
              {!mios.length ? (
                <Alerta tipo="info" titulo="Todavía no has pedido permisos aquí">
                  <p>Los que solicites van a aparecer en esta lista con su estado y su formulario.</p>
                </Alerta>
              ) : (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Permiso</th>
                      <th>Detalle</th>
                      <th>Estado</th>
                      <th>Solicitado</th>
                      <th>Formulario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mios.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {nombreTipo(p.tipo)}
                          {p.causal ? <span className="sub"> · {p.causal}</span> : null}
                        </td>
                        <td>{p.tipo === 'compensatorio' ? `${horasTexto(p.totalMinutos)} hrs` : f.dias(p.totalDias)}</td>
                        <td>
                          <span className={`etiqueta ${ETIQUETA[p.estado]}`}>{TEXTO_ESTADO_PERMISO[p.estado]}</span>
                        </td>
                        <td>{fechaHoraChile(p.creadaEn)}</td>
                        <td>
                          <Link href={`/mis-dias/permisos?codigo=${p.codigo}`}>Ver</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          <p style={{ marginTop: 24 }}>
            <Link className="boton boton-secundario boton-chico" href="/mis-dias">
              Volver a Mis días
            </Link>
          </p>
        </div>
      </div>
    </Marco>
  );
}
