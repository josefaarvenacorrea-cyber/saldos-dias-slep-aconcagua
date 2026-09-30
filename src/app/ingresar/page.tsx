import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Marco } from '@/componentes/Marco';
import { usuarioActual } from '@/lib/sesion';
import { FormularioIngreso } from './FormularioIngreso';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function Ingresar() {
  const u = await usuarioActual();
  if (u) redirect('/');
  return (
    <Marco>
      <div className="contenedor">
        <div className="caja-ingreso">
          <h1>Ingresa a Mis días</h1>
          <p className="texto-grande">Consulta tus días administrativos, tu feriado legal y tus descansos complementarios.</p>
          <FormularioIngreso />
          <details className="desplegable">
            <summary>¿Es tu primera vez?</summary>
            <p>
              Usa tu correo institucional. Tu contraseña inicial son los <strong>primeros cuatro dígitos de tu RUT</strong>, sin puntos (si tu RUT es 12.345.678-9, escribe
              1234). Al entrar te pediremos crear una contraseña nueva.
            </p>
          </details>
          <details className="desplegable">
            <summary>¿Olvidaste tu contraseña?</summary>
            <p>
              Escribe a <a href="mailto:administracion.personas@slepaconcagua.gob.cl">administracion.personas@slepaconcagua.gob.cl</a>. Gestión de Personas la restablecerá y podrás
              volver a entrar con los cuatro primeros dígitos de tu RUT.
            </p>
          </details>
        </div>
      </div>
    </Marco>
  );
}
