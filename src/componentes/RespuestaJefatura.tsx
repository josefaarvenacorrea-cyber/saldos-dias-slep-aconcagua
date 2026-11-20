'use client';

import { useActionState, useState } from 'react';
import { responder, type EstadoRespuesta } from '@/app/autorizaciones/acciones';
import { Alerta } from './Alerta';

interface Props {
  id: number;
  nombre: string;
  dias: string;
  periodo: string;
}

/**
 * La jefatura solo decide y firma. El formulario existe para denegar por buen servicio y proponer
 * la postergación, así que esa es la opción por defecto, pero autorizar el feriado también es válido
 * y en ese caso el trámite termina ahí.
 */
export function RespuestaJefatura({ id, nombre, dias, periodo }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoRespuesta, FormData>(responder, {});
  const [autoriza, setAutoriza] = useState<'si' | 'no'>('no');
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
        <span className="etiqueta-campo">¿Autoriza el uso del feriado?</span>
        <div className="opciones">
          <button
            type="button"
            className={`opcion ${autoriza === 'no' ? 'activa' : ''}`}
            aria-pressed={autoriza === 'no'}
            onClick={() => {
              setAutoriza('no');
              setConfirmando(false);
            }}
          >
            No, por razones de buen servicio
          </button>
          <button
            type="button"
            className={`opcion ${autoriza === 'si' ? 'activa' : ''}`}
            aria-pressed={autoriza === 'si'}
            onClick={() => {
              setAutoriza('si');
              setConfirmando(false);
            }}
          >
            Sí, autorizo el feriado
          </button>
        </div>
      </div>

      {autoriza === 'no' ? (
        <p className="texto-legal">
          Por razones de buen servicio, no se autoriza la solicitud de feriado legal y se propone postergar la época del
          feriado legal en los términos indicados en el artículo N°104 del DFL N°29, sobre Estatuto Administrativo.
        </p>
      ) : (
        <Alerta tipo="info" titulo="Si autoriza, el trámite termina aquí">
          <p>No habrá postergación que tramitar y {nombre} podrá tomar sus días dentro del año.</p>
        </Alerta>
      )}

      {confirmando ? (
        <div className="confirmacion">
          <p className="confirmacion-titulo">¿Está seguro?</p>
          <div className="confirmacion-detalle">
            <strong>Funcionario(a):</strong> {nombre}
            <br />
            <strong>Solicita:</strong> {dias}, {periodo}
            <br />
            <strong>Su respuesta:</strong>{' '}
            {autoriza === 'no' ? 'NO autoriza, propone postergar' : 'SÍ autoriza el feriado'}
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
