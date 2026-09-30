import type { Metadata } from 'next';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { requerirUsuario } from '@/lib/sesion';
import { FormularioClave } from './FormularioClave';

export const metadata: Metadata = { title: 'Cambiar contraseña' };

export default async function CambiarClave() {
  const u = await requerirUsuario({ permitirCambioPendiente: true });
  const enlaces = u.debe_cambiar ? [] : u.rol === 'admin' ? [{ href: '/admin', texto: 'Volver a la administración' }] : [{ href: '/mis-dias', texto: 'Mis días' }, { href: '/cambiar-clave', texto: 'Cambiar contraseña' }];
  return (
    <Marco usuario={u} enlaces={enlaces}>
      <div className="contenedor">
        <div className="caja-ingreso">
          <h1>{u.debe_cambiar ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h1>
          {u.debe_cambiar ? (
            <Alerta tipo="info" titulo="Es tu primer ingreso (o se restableció tu contraseña)">
              <p>Por seguridad, crea una contraseña nueva antes de continuar. Solo tú la conocerás: ni Gestión de Personas puede verla.</p>
            </Alerta>
          ) : null}
          <FormularioClave pedirActual={!u.debe_cambiar} />
        </div>
      </div>
    </Marco>
  );
}
