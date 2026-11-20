'use client';

import { useActionState, useState } from 'react';
import { responderSolicitudPermiso, type EstadoRespuesta } from '@/app/autorizaciones/acciones';
import { Alerta } from './Alerta';

/** La jefatura solo autoriza o rechaza el permiso y firma. Los datos ya vienen completos. */
export function RespuestaPermiso({ id, nombre, permiso, detalle }: { id: number; nombre: string; permiso: string; detalle: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoRespuesta, FormData>(responderSolicitudPermiso, {});
  const [autoriza, setAutoriza] = useState<'si' | 'no'>('si');
  const [confirmando, setConfirmando] = useState(false);

  return (
    <form action={enviar}>
      {estado.error ? (
        <Alerta tipo="error">
          <p>{estado.error}</p>
        </Alerta>
      ) : null}

      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="autoriza" value={autoriza} />

      <div className="campo">
        <span className="etiqueta-campo">¿Aprueba el permiso?</span>
        <div className="opciones">
          <button
            type="button"
            className={`opcion ${autoriza === 'si' ? 'activa' : ''}`}
            aria-pressed={autoriza === 'si'}
            onClick={() => {
              setAutoriza('si');
              setConfirmando(false);
            }}
          >
            Sí, apruebo
          </button>
          <button
            type="button"
            className={`opcion ${autoriza === 'no' ? 'activa' : ''}`}
            aria-pressed={autoriza === 'no'}
            onClick={() => {
              setAutoriza('no');
              setConfirmando(false);
            }}
          >
            No apruebo
          </button>
        </div>
      </div>

      {confirmando ? (
        <div className="confirmacion">
          <p className="confirmacion-titulo">¿Está seguro?</p>
          <div className="confirmacion-detalle">
            <strong>Funcionario(a):</strong> {nombre}
            <br />
            <strong>Permiso:</strong> {permiso}
            <br />
            <strong>Detalle:</strong> {detalle}
            <br />
            <strong>Su respuesta:</strong> {autoriza === 'si' ? 'SÍ aprueba' : 'NO aprueba'}
          </div>
          <p className="confirmacion-aviso">
            Al confirmar se estampará su firma en el formulario y quedará registrado su nombre, su RUN, la fecha, la hora y
            la dirección desde la que firmó. Esta acción no se puede deshacer.
          </p>
          <button className="boton" type="submit" disabled={enviando}>
            {enviando ? 'Firmando…' : 'Sí, firmar mi respuesta'}
          </button>
        </div>
      ) : (
        <button className="boton" type="button" onClick={() => setConfirmando(true)}>
          Firmar mi respuesta
        </button>
      )}
    </form>
  );
}
