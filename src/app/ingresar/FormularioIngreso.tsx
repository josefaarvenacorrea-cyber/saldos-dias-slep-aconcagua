'use client';

import { useActionState } from 'react';
import { ingresar, type EstadoFormulario } from '@/app/acciones';
import { Alerta } from '@/componentes/Alerta';

export function FormularioIngreso() {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(ingresar, {});
  return (
    <form action={accion} noValidate>
      {estado.error ? <Alerta tipo="error">{<p>{estado.error}</p>}</Alerta> : null}
      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          className="entrada"
          autoComplete="username"
          required
          defaultValue={estado.email}
          aria-invalid={estado.error ? true : undefined}
        />
      </div>
      <div className="campo">
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" name="clave" type="password" className="entrada" autoComplete="current-password" required aria-invalid={estado.error ? true : undefined} />
      </div>
      <button className="boton boton-primario boton-ancho" type="submit" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}
