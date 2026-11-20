'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { pedirPermiso, type EstadoPermisoForm } from '@/app/mis-dias/permisos/acciones';
import { Alerta } from './Alerta';
import { interferiadosDesde } from '@/lib/feriadosChile';
import {
  CAUSALES_OTROS,
  diasDelRango,
  esNoHabil,
  esPorHoras,
  horasTexto,
  motivoNoHabil,
  planRecuperacion,
  totalRecuperado,
  nombreTipo,
  revisar,
  TIPOS,
  type CausalOtros,
  type Jornada,
  type Saldos,
  type TipoPermiso,
} from '@/lib/reglasPermisos';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function legible(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS_SEMANA[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${a}`;
}

function textoDias(n: number): string {
  const t = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return `${t} ${Math.abs(n) === 1 ? 'día' : 'días'}`;
}

export function SolicitarPermiso({ saldos, jefaturaNombre, hoy }: { saldos: Saldos; jefaturaNombre: string; hoy: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoPermisoForm, FormData>(pedirPermiso, {});
  const [tipo, setTipo] = useState<TipoPermiso>('goce');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [jornadas, setJornadas] = useState<Record<string, Jornada>>({});
  const [horaDesde, setHoraDesde] = useState('08:30');
  const [horaHasta, setHoraHasta] = useState('11:30');
  const [causal, setCausal] = useState<CausalOtros>('Nacimiento');
  const [detalle, setDetalle] = useState('');
  const [certificado, setCertificado] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  // Devolución de horas del interferiado: cuántas, cuántas por día y desde cuándo.
  const [horasDevolver, setHorasDevolver] = useState('8');
  const [horasPorDia, setHorasPorDia] = useState('1');
  const [recuperarDesde, setRecuperarDesde] = useState('');

  const porHoras = esPorHoras(tipo);
  // El interferiado solo existe para días hábiles pegados a un feriado, así que en vez de dejar
  // elegir cualquier fecha se ofrecen las que corresponden.
  const interferiados = useMemo(() => (tipo === 'interferiado' ? interferiadosDesde(hoy) : []), [tipo, hoy]);
  const dias = useMemo(
    () => (desde && hasta ? diasDelRango(desde, porHoras ? desde : hasta, tipo, jornadas) : []),
    [desde, hasta, tipo, jornadas, porHoras],
  );
  const recuperacion = useMemo(() => {
    if (tipo !== 'interferiado') return null;
    const h = Number(horasDevolver.replace(',', '.'));
    const hd = Number(horasPorDia.replace(',', '.'));
    return {
      horas: Number.isFinite(h) ? h : 0,
      horasPorDia: Number.isFinite(hd) ? hd : 0,
      desde: recuperarDesde,
      dias: planRecuperacion(recuperarDesde, h, hd),
    };
  }, [tipo, horasDevolver, horasPorDia, recuperarDesde]);

  const revision = useMemo(
    () => revisar({ tipo, dias, horaDesde, horaHasta, certificado: certificado || null, recuperacion }, saldos),
    [tipo, dias, horaDesde, horaHasta, certificado, saldos, recuperacion],
  );

  function cambiarTipo(t: TipoPermiso) {
    setTipo(t);
    setConfirmando(false);
    if (t === 'feriado') setJornadas({});
  }

  function cambiarJornada(fecha: string, j: Jornada) {
    setJornadas((prev) => ({ ...prev, [fecha]: j }));
    setConfirmando(false);
  }

  const resumen = porHoras
    ? `${horasTexto(revision.minutos)} hrs del ${legible(desde)}`
    : `${textoDias(revision.dias)}${dias.length > 1 ? `, del ${legible(desde)} al ${legible(hasta)}` : `, el ${legible(desde)}`}`;

  return (
    <form action={enviar}>
      {estado.error ? (
        <Alerta tipo="error">
          <p>{estado.error}</p>
        </Alerta>
      ) : null}

      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="dias" value={JSON.stringify(dias)} />
      <input type="hidden" name="horaDesde" value={horaDesde} />
      <input type="hidden" name="horaHasta" value={horaHasta} />
      <input type="hidden" name="causal" value={tipo === 'otros' ? causal : ''} />
      <input type="hidden" name="detalle" value={tipo === 'otros' ? detalle : ''} />
      <input type="hidden" name="certificado" value={certificado} />
      <input type="hidden" name="horasDevolver" value={horasDevolver} />
      <input type="hidden" name="horasPorDia" value={horasPorDia} />
      <input type="hidden" name="recuperarDesde" value={recuperarDesde} />

      <div className="campo">
        <span className="etiqueta-campo">Permiso por solicitar</span>
        <div className="rejilla-tipos">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              className={`tarjeta-tipo ${tipo === t.valor ? 'activa' : ''}`}
              aria-pressed={tipo === t.valor}
              onClick={() => cambiarTipo(t.valor)}
            >
              <strong>{t.nombre}</strong>
              <span>{t.regla}</span>
            </button>
          ))}
        </div>
      </div>

      {tipo === 'otros' ? (
        <>
          <div className="filtros">
            <div className="campo">
              <label htmlFor="causal-sel">Causal</label>
              <select
                id="causal-sel"
                value={causal}
                onChange={(e) => {
                  setCausal(e.target.value as CausalOtros);
                  setConfirmando(false);
                }}
              >
                {CAUSALES_OTROS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {causal === 'Otros' ? (
              <div className="campo">
                <label htmlFor="detalle-otros">Detalle</label>
                <input id="detalle-otros" type="text" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
              </div>
            ) : null}
          </div>
          <div className="campo">
            <label htmlFor="cert">Certificado que respalda el permiso</label>
            <input
              id="cert"
              type="file"
              onChange={(e) => {
                setCertificado(e.target.files?.[0]?.name ?? '');
                setConfirmando(false);
              }}
            />
            <span className="sub">
              Por ahora se registra el nombre del archivo y tienes que hacerlo llegar a tu jefatura. La subida del archivo
              a la plataforma queda pendiente.
            </span>
          </div>
        </>
      ) : null}

      {tipo === 'interferiado' ? (
        interferiados.length ? (
          <div className="campo">
            <label htmlFor="inter">Día interferiado</label>
            <select
              id="inter"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setHasta(e.target.value);
                const elegido = interferiados.find((i) => i.fecha === e.target.value);
                if (elegido && !recuperarDesde) {
                  const [a, m, d] = elegido.feriado.split('-').map(Number);
                  const sig = new Date(a, m - 1, d + 1);
                  setRecuperarDesde(
                    `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}-${String(sig.getDate()).padStart(2, '0')}`,
                  );
                }
                setConfirmando(false);
              }}
            >
              <option value="">Elige un día</option>
              {interferiados.map((i) => (
                <option key={i.fecha} value={i.fecha}>
                  {legible(i.fecha)} · antes de {i.nombreFeriado}
                </option>
              ))}
            </select>
            <span className="sub">Son los únicos días en que se puede pedir este permiso.</span>
          </div>
        ) : (
          <Alerta tipo="info" titulo="No quedan días interferiados por delante">
            <p>Este permiso solo se puede pedir en un día hábil que esté justo antes de un feriado.</p>
          </Alerta>
        )
      ) : null}

      {tipo === 'interferiado' && desde ? (
        <section className="bloque-devolucion">
          <h3>Cómo vas a devolver las horas</h3>
          <p className="sub">
            El interferiado se toma con goce de remuneraciones, pero las horas de ese día se recuperan después. Tienes que
            dejar escrito en qué días y con qué distribución.
          </p>
          <div className="filtros">
            <div className="campo">
              <label htmlFor="hdev">Horas que trabajas ese día</label>
              <input id="hdev" type="number" min="1" max="12" step="0.5" value={horasDevolver}
                onChange={(e) => { setHorasDevolver(e.target.value); setConfirmando(false); }} required />
            </div>
            <div className="campo">
              <label htmlFor="hpd">Horas extra por día</label>
              <input id="hpd" type="number" min="0.5" max="8" step="0.5" value={horasPorDia}
                onChange={(e) => { setHorasPorDia(e.target.value); setConfirmando(false); }} required />
            </div>
            <div className="campo">
              <label htmlFor="rdesde">Desde cuándo</label>
              <input id="rdesde" type="date" value={recuperarDesde}
                onChange={(e) => { setRecuperarDesde(e.target.value); setConfirmando(false); }} required />
            </div>
          </div>
          {recuperacion && recuperacion.dias.length ? (
            <>
              <p className="sub">
                Devuelves <strong>{totalRecuperado(recuperacion.dias)} horas</strong> en{' '}
                {recuperacion.dias.length} {recuperacion.dias.length === 1 ? 'día' : 'días'} hábiles, saltando fines de
                semana y feriados.
              </p>
              <ul className="lista-devolucion">
                {recuperacion.dias.map((d) => (
                  <li key={d.fecha}>
                    <span>{legible(d.fecha)}</span>
                    <strong>+{d.horas} h</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {tipo !== 'interferiado' ? (
      <div className="filtros">
        <div className="campo">
          <label htmlFor="desde">{porHoras ? 'Fecha' : 'Desde'}</label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              if (porHoras || e.target.value > hasta) setHasta(e.target.value);
              setConfirmando(false);
            }}
            required
          />
        </div>
        {!porHoras ? (
          <div className="campo">
            <label htmlFor="hasta">Hasta</label>
            <input
              id="hasta"
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => {
                setHasta(e.target.value);
                setConfirmando(false);
              }}
              required
            />
          </div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="hd">Hora desde</label>
              <input id="hd" type="time" value={horaDesde} onChange={(e) => { setHoraDesde(e.target.value); setConfirmando(false); }} required />
            </div>
            <div className="campo">
              <label htmlFor="hh">Hora hasta</label>
              <input id="hh" type="time" value={horaHasta} onChange={(e) => { setHoraHasta(e.target.value); setConfirmando(false); }} required />
            </div>
          </>
        )}
      </div>
      ) : null}

      {!porHoras && dias.length && tipo !== 'interferiado' ? (
        <div className="campo">
          <span className="etiqueta-campo">
            {tipo === 'feriado' ? 'Días (el feriado legal solo admite jornada completa)' : 'Jornada por día'}
          </span>
          <ul className="lista-dias">
            {dias.map((d) => {
              const libre = esNoHabil(d.fecha);
              const motivo = motivoNoHabil(d.fecha);
              return (
                <li key={d.fecha} className={libre ? 'no-habil' : ''}>
                  <span className="fecha-dia">{legible(d.fecha)}</span>
                  {libre ? (
                    <span className="sub">{motivo === 'fin de semana' ? 'fin de semana' : motivo}, no se descuenta</span>
                  ) : tipo === 'feriado' ? (
                    <span className="sub">jornada completa</span>
                  ) : (
                    <span className="opciones">
                      {(['completa', 'am', 'pm'] as const).map((j) => (
                        <button
                          key={j}
                          type="button"
                          className={`opcion chica ${d.jornada === j ? 'activa' : ''}`}
                          aria-pressed={d.jornada === j}
                          onClick={() => cambiarJornada(d.fecha, j)}
                        >
                          {j === 'completa' ? 'Completa' : j === 'am' ? '½ AM' : '½ PM'}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className={`resumen-solicitud ${revision.ok ? 'bien' : 'mal'}`}>
        {revision.ok ? `Solicitas ${resumen}.` : revision.error}
      </p>

      {confirmando ? (
        <div className="confirmacion">
          <p className="confirmacion-titulo">¿Estás seguro?</p>
          <div className="confirmacion-detalle">
            <strong>Permiso:</strong> {nombreTipo(tipo)}
            {tipo === 'otros' ? ` · ${causal}${causal === 'Otros' && detalle ? ` (${detalle})` : ''}` : ''}
            <br />
            <strong>Detalle:</strong> {resumen}
            <br />
            {tipo === 'interferiado' && recuperacion ? (
              <>
                <strong>Devuelves:</strong> {totalRecuperado(recuperacion.dias)} horas, {recuperacion.horasPorDia} h extra
                por día, del {legible(recuperacion.dias[0]?.fecha ?? '')} al{' '}
                {legible(recuperacion.dias[recuperacion.dias.length - 1]?.fecha ?? '')}
                <br />
              </>
            ) : null}
            <strong>Jefatura:</strong> {jefaturaNombre}
          </div>
          <p className="confirmacion-aviso">
            Al confirmar se estampará tu firma en el formulario y quedará registrado tu nombre, tu RUN, la fecha, la hora y
            la dirección desde la que firmaste. Esta acción no se puede deshacer.
          </p>
          <button className="boton" type="submit" disabled={enviando}>
            {enviando ? 'Firmando…' : 'Sí, firmar y enviar a mi jefatura'}
          </button>
        </div>
      ) : (
        <button className="boton" type="button" disabled={!revision.ok} onClick={() => setConfirmando(true)}>
          Firmar y enviar a mi jefatura
        </button>
      )}
    </form>
  );
}
