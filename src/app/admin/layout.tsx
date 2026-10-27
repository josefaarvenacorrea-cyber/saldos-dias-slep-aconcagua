import { Marco } from '@/componentes/Marco';
import { requerirAdmin } from '@/lib/sesion';

const ENLACES = [
  { href: '/admin', texto: 'Resumen' },
  { href: '/admin/cargas', texto: 'Cargar datos' },
  { href: '/admin/funcionarios', texto: 'Funcionarios' },
  { href: '/admin/alertas', texto: 'Alertas' },
  { href: '/admin/feriado', texto: 'Feriado por vencer' },
  { href: '/admin/auditoria', texto: 'Registro de actividad' },
  { href: '/cambiar-clave', texto: 'Mi contraseña' },
];

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const u = await requerirAdmin();
  return (
    <Marco usuario={u} enlaces={ENLACES}>
      <div className="contenedor">{children}</div>
    </Marco>
  );
}
