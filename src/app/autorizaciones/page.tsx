import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { RespuestaJefatura } from '@/componentes/RespuestaJefatura';
import { fechaCorta, fechaHoraChile } from '@/lib/fechas';
import { firmaDe } from '@/lib/firmas';
import { PROCESO_POSTERGACION } from '@/lib/postergacion';
import { pendientesDeJefatura, respondidasPorJefatura, TEXTO_ESTADO } from '@/lib/postergaciones';
import * as f from '@/lib/formato';
import { enlacesDe } from '@/lib/enlaces';
import { requerirUsuario } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Autorizaciones' };


export default async function Autorizaciones() {
  const u = await requerirUsuario();
  if (u.rol === 'admin') redirect('/admin');

  const proc = PROCESO_POSTERGACION;
  const [pendientes, respondidas, firma, enlaces] = await Promise.all([
    pendientesDeJefatura(u.rut ?? ''),
    respondidasPorJefatura(u.rut ?? ''),
    firmaDe(u.id),
    enlacesDe(u.rut),
  ]);

  const periodoDe = (inicio: string | null, anio: number) =>
    inicio ? `del ${fechaCorta(inicio)} al 31-12-${anio}` : `hasta el 31-12-${anio}`;

  return (
    <Marco usuario={u} enlaces={enlaces}>
      <div className="contenedor">
        <div className="seccion">
          <h1>Autorizaciones</h1>
          <p className="texto-grande">
            Solicitudes de postergación de feriado legal de las personas a tu cargo. Solo tienes que decidir y firmar: los
            datos ya vienen completos.
          </p>

          {!firma && pendientes.length > 0 ? (
            <Alerta tipo="advertencia" titulo="Primero guarda tu firma">
              <p>
                Para responder necesitas tener tu firma guardada. <Link href="/mi-firma">Guárdala en Mi firma</Link> y
                vuelve.
              </p>
            </Alerta>
          ) : null}

          {!pendientes.length ? (
            <Alerta tipo="info" titulo="No tienes solicitudes pendientes">
              <p>
                Cuando alguien de tu equipo solicite postergar su feriado legal de {proc.anioAPostergar}, aparecerá aquí
                para que la respondas.
              </p>
            </Alerta>
          ) : null}

          {pendientes.map((p) => (
            <section className="tarjeta" key={p.id} style={{ marginBottom: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 2 }}>{p.ficha.nombre}</h2>
              <p className="sub" style={{ marginTop: 0 }}>
                RUN {p.ficha.rutTexto}
                {p.ficha.cargo ? ` · ${p.ficha.cargo}` : ''}
                {p.ficha.grado ? `, grado ${p.ficha.grado}` : ''}
                {p.ficha.unidad ? ` · ${p.ficha.unidad}` : ''}
              </p>

              <ul className="desglose" style={{ marginBottom: 16 }}>
                <li>
                  <span>Tipo de permiso</span>
                  <strong>Feriado Legal</strong>
                </li>
                <li>
                  <span>Período solicitado</span>
                  <strong>{periodoDe(p.fechaInicio, p.anio)}</strong>
                </li>
                <li>
                  <span>N° de días</span>
                  <strong>{f.dias(p.diasSolicitados)}</strong>
                </li>
                <li>
                  <span>Solicitada el</span>
                  <strong>{fechaHoraChile(p.creadaEn)}</strong>
                </li>
              </ul>

              {firma ? (
                <RespuestaJefatura
                  id={p.id}
                  nombre={p.ficha.nombre}
                  dias={f.dias(p.diasSolicitados)}
                  periodo={periodoDe(p.fechaInicio, p.anio)}
                />
              ) : null}
            </section>
          ))}

          {respondidas.length ? (
            <details className="desplegable">
              <summary>Solicitudes que ya respondiste ({respondidas.length})</summary>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Funcionario(a)</th>
                    <th>Días</th>
                    <th>Estado</th>
                    <th>Código</th>
                  </tr>
                </thead>
                <tbody>
                  {respondidas.map((p) => (
                    <tr key={p.id}>
                      <td>{p.ficha.nombre}</td>
                      <td>{f.dias(p.diasAcumular ?? p.diasSolicitados)}</td>
                      <td>{TEXTO_ESTADO[p.estado]}</td>
                      <td>{p.codigo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </div>
      </div>
    </Marco>
  );
}
