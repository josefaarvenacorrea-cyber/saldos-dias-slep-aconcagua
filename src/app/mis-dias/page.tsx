import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { VistaFicha } from '@/componentes/VistaFicha';
import { fichaDe } from '@/lib/datos';
import { requerirUsuario } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Mis días' };

const ENLACES = [
  { href: '/mis-dias', texto: 'Mis días' },
  { href: '/cambiar-clave', texto: 'Cambiar contraseña' },
];

export default async function MisDias({ searchParams }: { searchParams: Promise<{ tipo?: string; clave?: string }> }) {
  const u = await requerirUsuario();
  if (u.rol === 'admin') redirect('/admin');
  const { tipo, clave } = await searchParams;
  const ficha = await fichaDe(u.rut ?? '');
  const nombre = (ficha.dias?.nombre || ficha.dotacion?.nombre || u.nombre || '').split(' ')[0];
  return (
    <Marco usuario={u} enlaces={ENLACES}>
      <div className="contenedor">
        <div className="seccion">
          <h1>Hola{nombre ? `, ${nombre}` : ''}</h1>
          <p className="texto-grande">Aquí están tus días administrativos, tu feriado legal y tus descansos complementarios.</p>
          {clave === 'ok' ? (
            <Alerta tipo="exito" titulo="Tu contraseña quedó guardada">
              <p>La próxima vez ingresa con tu correo y tu contraseña nueva.</p>
            </Alerta>
          ) : null}
          {!ficha.dias && !ficha.descansos ? (
            <Alerta tipo="info" titulo="Todavía no hay información para ti">
              <p>Gestión de Personas aún no ha cargado tus saldos. Vuelve a revisar más tarde.</p>
            </Alerta>
          ) : null}
        </div>
        <VistaFicha ficha={ficha} filtro={tipo} rutaBase="/mis-dias" />
      </div>
    </Marco>
  );
}
