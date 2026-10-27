import Link from 'next/link';
import type { Ficha } from '@/lib/datos';
import { anioActualChile, fechaCorta, fechaHoraChile } from '@/lib/fechas';
import { feriadoPorVencer } from '@/lib/feriado';
import * as f from '@/lib/formato';
import { formatearRut } from '@/lib/rut';
import type { Solicitud, TipoSolicitud } from '@/lib/tipos';
import { Alerta } from './Alerta';
import { Calendario, NOMBRE_TIPO } from './Calendario';
import { CORREO_CONTACTO } from './Marco';

type Filtro = 'todas' | TipoSolicitud;

const PESTANAS: { valor: Filtro; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'administrativo', texto: 'Días administrativos' },
  { valor: 'feriado_legal', texto: 'Feriado legal' },
  { valor: 'descanso', texto: 'Descansos complementarios' },
];

function Estado({ comentario }: { comentario: string | null }) {
  if (!comentario) return <span className="etiqueta etiqueta-neutra">Registrada</span>;
  if (/pendiente|falta/i.test(comentario)) {
    return (
      <>
        <span className="etiqueta etiqueta-advertencia">Pendiente</span>
        <br />
        <span className="sub">{comentario}</span>
      </>
    );
  }
  if (/regulariz/i.test(comentario)) return <span className="etiqueta etiqueta-exito">{comentario}</span>;
  return <span className="sub">{comentario}</span>;
}

function TarjetaSaldo(props: {
  clase: string;
  titulo: string;
  saldo: string;
  unidad: string;
  negativo: boolean;
  usado: number;
  total: number;
  resumen: string;
  desglose: [string, string][];
}) {
  return (
    <section className={`tarjeta saldo ${props.clase} ${props.negativo ? 'saldo-negativo' : ''}`} aria-label={props.titulo}>
      <h2 className="saldo-titulo">{props.titulo}</h2>
      <div className="saldo-cifra">
        {props.saldo}
        <small>{props.unidad}</small>
      </div>
      <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f.porcentaje(props.usado, props.total))} aria-label={`Usado: ${Math.round(f.porcentaje(props.usado, props.total))} %`}>
        <span style={{ width: `${f.porcentaje(props.usado, props.total)}%` }} />
      </div>
      <p className="sub" style={{ margin: 0 }}>
        {props.resumen}
      </p>
      <ul className="desglose">
        {props.desglose.map(([k, v]) => (
          <li key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SinDatos({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="tarjeta saldo" aria-label={titulo} style={{ borderTopColor: 'var(--gris-20)' }}>
      <h2 className="saldo-titulo">{titulo}</h2>
      <p className="sub">{texto}</p>
    </section>
  );
}

/** Todo lo que ve un funcionario. La administración ve exactamente lo mismo en la ficha de cada persona. */
export function VistaFicha({ ficha, filtro, rutaBase }: { ficha: Ficha; filtro: string | undefined; rutaBase: string }) {
  const { dias, descansos, dotacion } = ficha;
  const anio = dias?.anio ?? new Date().getFullYear();
  const todas: Solicitud[] = [...(dias?.solicitudes ?? []), ...(descansos?.solicitudes ?? [])];
  const actual: Filtro = PESTANAS.some((p) => p.valor === filtro) ? (filtro as Filtro) : 'todas';
  const lista = todas
    .filter((s) => actual === 'todas' || s.tipo === actual)
    .sort((a, b) => (b.inicio ?? '').localeCompare(a.inicio ?? '') || b.fila - a.fila);
  const pendientes = todas.filter((s) => s.comentario && /pendiente|falta/i.test(s.comentario)).length;
  // Solo con la base del año en curso: con una base antigua el plazo ya pasó.
  const porVencer = dias && dias.anio === anioActualChile() ? feriadoPorVencer(dias.feriadoLegal) : 0;

  return (
    <>
      {ficha.actualizado ? (
        <p className="sub">
          Información actualizada al <strong>{fechaHoraChile(ficha.actualizado)}</strong>.
        </p>
      ) : null}

      {porVencer > 0 ? (
        <Alerta tipo="advertencia" titulo={porVencer === 1 ? 'Tienes 1 día de feriado legal que vence este año' : `Tienes ${f.dias(porVencer)} de feriado legal que vencen este año`}>
          <p>
            {porVencer === 1
              ? `Es un día acumulado de años anteriores y no se puede postergar. Si no lo tomas antes del 31 de diciembre de ${anio}, lo perderás.`
              : `Son días acumulados de años anteriores y no se pueden postergar. Si no los tomas antes del 31 de diciembre de ${anio}, los perderás.`}
          </p>
        </Alerta>
      ) : null}

      <div className="grilla grilla-3 seccion">
        {dias ? (
          <TarjetaSaldo
            clase="saldo-administrativo"
            titulo="Días administrativos"
            saldo={f.numero(dias.administrativos.saldo)}
            unidad={Math.abs(dias.administrativos.saldo) === 1 ? 'día disponible' : 'días disponibles'}
            negativo={dias.administrativos.saldo < 0}
            usado={dias.administrativos.usados}
            total={dias.administrativos.inicial}
            resumen={`Usaste ${f.numero(dias.administrativos.usados)} de ${f.dias(dias.administrativos.inicial)} en ${anio}.`}
            desglose={[
              [`Días del año ${anio}`, f.numero(dias.administrativos.inicial)],
              ['Usados', f.numero(dias.administrativos.usados)],
              ['Disponibles', f.numero(dias.administrativos.saldo)],
            ]}
          />
        ) : (
          <SinDatos titulo="Días administrativos" texto="Todavía no hay información de días administrativos para ti." />
        )}
        {dias ? (
          <TarjetaSaldo
            clase="saldo-feriado"
            titulo="Feriado legal (vacaciones)"
            saldo={f.numero(dias.feriadoLegal.saldo)}
            unidad={Math.abs(dias.feriadoLegal.saldo) === 1 ? 'día disponible' : 'días disponibles'}
            negativo={dias.feriadoLegal.saldo < 0}
            usado={dias.feriadoLegal.usados}
            total={dias.feriadoLegal.inicial}
            resumen={`Usaste ${f.numero(dias.feriadoLegal.usados)} de ${f.dias(dias.feriadoLegal.inicial)}.`}
            desglose={[
              ['Acumulados del año anterior', f.numero(dias.feriadoLegal.acumuladoAnterior)],
              [`Días del año ${anio}`, f.numero(dias.feriadoLegal.anualidad)],
              ['Usados', f.numero(dias.feriadoLegal.usados)],
              ['Disponibles', f.numero(dias.feriadoLegal.saldo)],
            ]}
          />
        ) : (
          <SinDatos titulo="Feriado legal (vacaciones)" texto="Todavía no hay información de feriado legal para ti." />
        )}
        {descansos ? (
          <TarjetaSaldo
            clase="saldo-descanso"
            titulo="Descanso complementario"
            saldo={f.horas(descansos.saldo)}
            unidad="disponibles"
            negativo={descansos.saldo < 0}
            usado={descansos.usadas}
            total={descansos.totalReconocidas}
            resumen={`Usaste ${f.horas(descansos.usadas)} de ${f.horas(descansos.totalReconocidas)} reconocidas.`}
            desglose={[
              ['Horas reconocidas', f.horas(descansos.totalReconocidas)],
              ['Usadas', f.horas(descansos.usadas)],
              ['Disponibles', f.horas(descansos.saldo)],
            ]}
          />
        ) : (
          <SinDatos titulo="Descanso complementario" texto="No tienes horas de descanso complementario registradas." />
        )}
      </div>

      {dias?.administrativos.saldo !== undefined && (dias.administrativos.saldo < 0 || dias.feriadoLegal.saldo < 0 || (descansos?.saldo ?? 0) < 0) ? (
        <Alerta tipo="advertencia" titulo="Hay un saldo negativo">
          <p>
            Puede deberse a un registro pendiente de corrección. Si crees que hay un error, escribe a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.
          </p>
        </Alerta>
      ) : null}
      {pendientes > 0 ? (
        <Alerta tipo="info" titulo={pendientes === 1 ? 'Tienes 1 solicitud con algo pendiente' : `Tienes ${pendientes} solicitudes con algo pendiente`}>
          <p>Revisa el detalle en el historial (por ejemplo, una solicitud sin firmar).</p>
        </Alerta>
      ) : null}

      <section className="seccion" aria-labelledby="titulo-calendario">
        <h2 id="titulo-calendario">Calendario {anio}</h2>
        <Calendario anio={anio} solicitudes={todas} />
      </section>

      <section className="seccion" aria-labelledby="titulo-historial">
        <h2 id="titulo-historial">Historial de solicitudes</h2>
        <nav className="pestanas" aria-label="Filtrar solicitudes">
          {PESTANAS.map((p) => (
            <Link key={p.valor} href={p.valor === 'todas' ? `${rutaBase}#titulo-historial` : `${rutaBase}?tipo=${p.valor}#titulo-historial`} aria-current={actual === p.valor ? 'page' : undefined} scroll={false}>
              {p.texto}
            </Link>
          ))}
        </nav>
        {lista.length ? (
          <div className="tabla-contenedor">
            <table className="tabla">
              <caption className="oculto-visual">Solicitudes registradas, de la más reciente a la más antigua</caption>
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Desde</th>
                  <th scope="col">Hasta</th>
                  <th scope="col" className="num">
                    Cantidad
                  </th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={`${s.unidad}-${s.fila}`}>
                    <td>
                      <span className={`muestra m-${s.tipo.replace('_', '-')}`} aria-hidden="true" style={{ marginRight: 8, verticalAlign: '-3px' }} />
                      {s.tipo === 'otro' ? s.tipoTexto : NOMBRE_TIPO[s.tipo]}
                    </td>
                    <td className="nowrap">{fechaCorta(s.inicio) || '—'}</td>
                    <td className="nowrap">{fechaCorta(s.termino) || '—'}</td>
                    <td className="num">{s.unidad === 'horas' ? f.horas(s.cantidad) : f.dias(s.cantidad)}</td>
                    <td>
                      <Estado comentario={s.comentario} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hay solicitudes registradas en esta categoría.</p>
        )}
      </section>

      {descansos && descansos.reconocidas.length ? (
        <section className="seccion" aria-labelledby="titulo-reconocidas">
          <h2 id="titulo-reconocidas">Horas de descanso complementario reconocidas</h2>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Origen</th>
                  <th scope="col" className="num">
                    Horas
                  </th>
                  <th scope="col">Vencen el</th>
                </tr>
              </thead>
              <tbody>
                {descansos.reconocidas.map((r) => (
                  <tr key={r.fuente}>
                    <td>{r.fuente}</td>
                    <td className="num">{f.horas(r.horas)}</td>
                    <td className="nowrap">{r.vence ? fechaCorta(r.vence) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {dias?.otrosPermisos ? (
        <section className="seccion" aria-labelledby="titulo-otros">
          <h2 id="titulo-otros">Otros permisos registrados</h2>
          <p>{dias.otrosPermisos}</p>
        </section>
      ) : null}

      {dotacion ? (
        <section className="seccion" aria-labelledby="titulo-datos">
          <h2 id="titulo-datos">Mis datos</h2>
          <dl className="lista-datos">
            {(
              [
                ['Nombre', dotacion.nombre],
                ['RUT', formatearRut(dotacion.rut)],
                ['Cargo', dotacion.cargoOrganigrama || dotacion.cargo],
                ['Área o subdirección', dotacion.area],
                ['Estamento', dotacion.estamento],
                ['Calidad jurídica', dotacion.calidadJuridica],
                ['Grado', dotacion.grado],
                ['Fecha de ingreso al SLEP', fechaCorta(dotacion.fechaIngreso)],
                ['Jefatura', dotacion.jefatura],
                ['Correo institucional', dotacion.correoInstitucional ?? ''],
              ] as [string, string][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      <Alerta tipo="info" titulo="¿Cómo se calcula tu saldo?">
        <p>
          Saldo disponible = días (u horas) que te corresponden en el año, menos las solicitudes registradas en el historial. Los días se cuentan en días hábiles. Si algo no
          cuadra, escribe a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a> indicando la fecha y el tipo de permiso.
        </p>
      </Alerta>
    </>
  );
}
