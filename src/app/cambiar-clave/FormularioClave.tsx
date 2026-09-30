'use client';

import { useActionState } from 'react';
import { cambiarClave, type EstadoFormulario } from '@/app/acciones';
import { Alerta } from '@/componentes/Alerta';

export function FormularioClave({ pedirActual }: { pedirActual: boolean }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(cambiarClave, {});
  return (
    <form action={accion} noValidate>
      {estado.error ? <Alerta tipo="error">{<p>{estado.error}</p>}</Alerta> : null}
      {pedirActual ? (
        <div className="campo">
          <label htmlFor="actual">Contraseña actual</label>
          <input id="actual" name="actual" type="password" className="entrada" autoComplete="current-password" required />
        </div>
      ) : null}
      <div className="campo">
        <label htmlFor="nueva">Contraseña nueva</label>
        <span className="ayuda" id="ayuda-nueva">
          Al menos 8 caracteres, con letras y números. No uses tu RUT.
        </span>
        <input id="nueva" name="nueva" type="password" className="entrada" autoComplete="new-password" required minLength={8} aria-describedby="ayuda-nueva" />
      </div>
      <div className="campo">
        <label htmlFor="confirmar">Repite la contraseña nueva</label>
        <input id="confirmar" name="confirmar" type="password" className="entrada" autoComplete="new-password" required minLength={8} />
      </div>
      <button className="boton boton-primario boton-ancho" type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
