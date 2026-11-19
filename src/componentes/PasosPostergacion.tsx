'use client';

import { useActionState, useState } from 'react';
import { aceptar, solicitar, type EstadoPaso } from '@/app/mis-dias/postergacion/acciones';
import { Alerta } from './Alerta';

/** Texto "1,5 días" sin depender del servidor. */
function dias(n: number): string {
  const t = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return `${t} ${Math.abs(n) === 1 ? 'día' : 'días'}`;
}

function fechaLegible(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** Aviso de lo que se está por firmar. Dice exactamente qué queda registrado y que no se puede deshacer. */
function Confirmacion({ titulo, detalle, textoBoton, enviando }: { titulo: string; detalle: React.ReactNode; textoBoton: string; enviando: boolean }) {
  return (
    <div className="confirmacion">
      <p className="confirmacion-titulo">{titulo}</p>
      <div className="confirmacion-detalle">{detalle}</div>
      <p className="confirmacion-aviso">
        Al confirmar se estampará tu firma en el formulario y quedará registrado tu nombre, tu RUN, la fecha, la hora y la
        dirección desde la que firmaste. Esta acción no se puede deshacer.
      </p>
      <button className="boton" type="submit" disabled={enviando}>
        {enviando ? 'Firmando…' : textoBoton}
      </button>
    </div>
  );
}

/** Sección I: pedir el feriado. */
export function FormularioSolicitud({ postergable, porVencer, anio }: { postergable: number; porVencer: number; anio: number }) {
  const [estado, enviar, enviando] = useActionState<EstadoPaso, FormData>(solicitar, {});
  const [diasPedidos, setDias] = useState(String(postergable));
  const [desde, setDesde] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const n = Number(diasPedidos.replace(',', '.'));
  const valido = Number.isFinite(n) && n > 0 && n <= postergable;

  return (
    <form action={enviar}>
      {estado.error ? (
        <Alerta tipo="error">
          <p>{estado.error}</p>
        </Alerta>
      ) : null}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="dias">N° de días que quieres postergar</label>
          <input
            id="dias"
            name="dias"
            type="number"
            min="0.5"
            max={postergable}
            step="0.5"
            value={diasPedidos}
            onChange={(e) => {
              setDias(e.target.value);
              setConfirmando(false);
            }}
            required
          />
          <span className="sub">Máximo {dias(postergable)}.</span>
        </div>
        <div className="campo">
          <label htmlFor="desde">Fecha de inicio del feriado que pides</label>
          <input
            id="desde"
            name="desde"
            type="date"
            value={desde}
            min={`${anio}-01-01`}
            max={`${anio}-12-31`}
            onChange={(e) => {
              setDesde(e.target.value);
              setConfirmando(false);
            }}
          />
          <span className="sub">La fecha de término es siempre el 31-12-{anio}.</span>
        </div>
      </div>

      {!valido ? (
        <p className="sub">
          Solo puedes postergar hasta {dias(postergable)}, que son los del año {anio}.
        </p>
      ) : null}

      {porVencer > 0 ? (
        <Alerta tipo="advertencia" titulo={`${dias(porVencer)} no se pueden postergar`}>
          <p>
            Vienen de años anteriores y el artículo N°104 no permite acumularlos otra vez. Tienes que tomarlos antes del
            31 de diciembre para no perderlos.
          </p>
        </Alerta>
      ) : null}

      {confirmando ? (
        <Confirmacion
          titulo="¿Estás seguro?"
          textoBoton="Sí, firmar y enviar a mi jefatura"
          enviando={enviando}
          detalle={
            <>
              <strong>Permiso:</strong> Feriado Legal
              <br />
              <strong>Período:</strong> {desde ? `del ${fechaLegible(desde)} ` : ''}hasta el 31-12-{anio}
              <br />
              <strong>N° de días:</strong> {dias(n)}
            </>
          }
        />
      ) : (
        <button className="boton" type="button" disabled={!valido} onClick={() => setConfirmando(true)}>
          Firmar y enviar a mi jefatura
        </button>
      )}
    </form>
  );
}

/** Sección III: aceptar la postergación y declarar los días. */
export function FormularioAceptacion({ postergable, maximoSolicitado, anio, anioDestino }: { postergable: number; maximoSolicitado: number; anio: number; anioDestino: number }) {
  const tope = Math.min(postergable, maximoSolicitado);
  const [estado, enviar, enviando] = useActionState<EstadoPaso, FormData>(aceptar, {});
  const [acepta, setAcepta] = useState<'si' | 'no'>('si');
  const [diasAcumular, setDias] = useState(String(tope));
  const [confirmando, setConfirmando] = useState(false);

  const n = Number(diasAcumular.replace(',', '.'));
  const valido = acepta === 'no' || (Number.isFinite(n) && n > 0 && n <= tope);

  return (
    <form action={enviar}>
      {estado.error ? (
        <Alerta tipo="error">
          <p>{estado.error}</p>
        </Alerta>
      ) : null}

      <input type="hidden" name="acepta" value={acepta} />

      <div className="campo">
        <span className="etiqueta-campo">¿Aceptas la postergación que propone tu jefatura?</span>
        <div className="opciones">
          {(['si', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`opcion ${acepta === v ? 'activa' : ''}`}
              aria-pressed={acepta === v}
              onClick={() => {
                setAcepta(v);
                setConfirmando(false);
              }}
            >
              {v === 'si' ? 'Sí, acepto' : 'No acepto'}
            </button>
          ))}
        </div>
      </div>

      {acepta === 'si' ? (
        <div className="campo" style={{ maxWidth: 280 }}>
          <label htmlFor="acumular">N° de días que solicitas acumular para {anioDestino}</label>
          <input
            id="acumular"
            name="dias"
            type="number"
            min="0.5"
            max={tope}
            step="0.5"
            value={diasAcumular}
            onChange={(e) => {
              setDias(e.target.value);
              setConfirmando(false);
            }}
            required
          />
          <span className="sub">Máximo {dias(tope)}.</span>
        </div>
      ) : (
        <Alerta tipo="advertencia" titulo="Si no aceptas, el trámite termina sin acumulación">
          <p>Tus días pendientes tendrán que usarse antes del 31 de diciembre de {anio}.</p>
        </Alerta>
      )}

      {confirmando ? (
        <Confirmacion
          titulo="¿Estás seguro?"
          textoBoton={acepta === 'si' ? 'Sí, firmar y solicitar la acumulación' : 'Sí, firmar mi rechazo'}
          enviando={enviando}
          detalle={
            acepta === 'si' ? (
              <>
                <strong>Aceptas la postergación:</strong> SI
                <br />
                <strong>Días que acumulas para {anioDestino}:</strong> {dias(n)}
                <br />
                <strong>Origen:</strong> feriado legal del año {anio}
              </>
            ) : (
              <>
                <strong>Aceptas la postergación:</strong> NO
                <br />
                Tus días pendientes deberán usarse antes del 31-12-{anio}.
              </>
            )
          }
        />
      ) : (
        <button className="boton" type="button" disabled={!valido} onClick={() => setConfirmando(true)}>
          {acepta === 'si' ? 'Firmar y solicitar la acumulación' : 'Firmar mi rechazo'}
        </button>
      )}
    </form>
  );
}
