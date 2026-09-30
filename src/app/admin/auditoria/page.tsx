import type { Metadata } from 'next';
import { auditoriaReciente, NOMBRE_ARCHIVO } from '@/lib/datos';
import { fechaHoraChile } from '@/lib/fechas';
import { requerirAdmin } from '@/lib/sesion';
import type { TipoArchivo } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Registro de actividad' };

const ACCIONES: Record<string, string> = {
  ingreso: 'Ingresó',
  salida: 'Salió',
  ingreso_fallido: 'Intento de ingreso fallido',
  bloqueo_por_intentos: 'Cuenta bloqueada por intentos fallidos',
  cambio_de_clave: 'Cambió su contraseña',
  carga: 'Cargó datos',
  cambio_de_carga_activa: 'Volvió a una versión anterior de datos',
  restablecer_clave: 'Restableció una contraseña',
  desbloquear: 'Desbloqueó una cuenta',
  deshabilitar_cuenta: 'Deshabilitó una cuenta',
  habilitar_cuenta: 'Habilitó una cuenta',
  cambiar_correo: 'Cambió un correo de ingreso',
  correo_desde_dotacion: 'Volvió a usar el correo de la Dotación',
};

function detalle(accion: string, d: Record<string, unknown> | null): string {
  if (!d) return '';
  if (accion === 'carga') return `${NOMBRE_ARCHIVO[d.tipo as TipoArchivo] ?? d.tipo}: ${d.archivo}`;
  if (accion === 'cambio_de_carga_activa') return `${NOMBRE_ARCHIVO[d.tipo as TipoArchivo] ?? d.tipo} (carga ${d.carga})`;
  if (d.funcionario) return `RUT ${d.funcionario}`;
  if (d.motivo === 'correo_desconocido') return 'Correo no registrado';
  if (d.motivo === 'cuenta_inactiva') return 'Cuenta inactiva';
  if (d.motivo === 'clave') return 'Contraseña incorrecta';
  return '';
}

export default async function Auditoria() {
  await requerirAdmin();
  const eventos = await auditoriaReciente(300);
  return (
    <div className="seccion">
      <h1>Registro de actividad</h1>
      <p className="sub">Últimos 300 eventos: ingresos, cambios de contraseña, cargas de datos y acciones de administración.</p>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Quién</th>
              <th scope="col">Qué</th>
              <th scope="col">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{fechaHoraChile(e.en)}</td>
                <td>{e.actor ?? '—'}</td>
                <td>{ACCIONES[e.accion] ?? e.accion}</td>
                <td>{detalle(e.accion, e.detalle)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
