import Image from 'next/image';
import Link from 'next/link';
import logoInstitucional from '../../public/logos/slep-aconcagua-institucional.png';
import logoEducacion from '../../public/logos/educacion-publica.png';
import logoAconcagua from '../../public/logos/aconcagua.png';
import { salir } from '@/app/acciones';
import { Navegacion, type Enlace } from './Navegacion';

export const CORREO_CONTACTO = 'administracion.personas@slepaconcagua.gob.cl';

interface Props {
  usuario?: { nombre: string | null; rol: 'funcionario' | 'admin' } | null;
  enlaces?: Enlace[];
  children: React.ReactNode;
}

/** Encabezado + contenido + pie, con la identidad del Kit Digital y los logos del SLEP. */
export function Marco({ usuario, enlaces, children }: Props) {
  return (
    <>
      <header>
        <div className="encabezado">
          <div className="contenedor encabezado-fila">
            <Link href="/" className="marca">
              <Image src={logoInstitucional} alt="Servicio Local de Educación Pública Aconcagua, Ministerio de Educación" priority />
              <span className="marca-texto">
                <strong>Mis días</strong>
                <span>Días administrativos, feriado legal y descansos</span>
              </span>
            </Link>
            {usuario ? (
              <div className="usuario">
                <span className="usuario-nombre">
                  <strong>{usuario.nombre}</strong>
                  {usuario.rol === 'admin' ? 'Administración' : 'Funcionario/a'}
                </span>
                <form action={salir}>
                  <button className="boton boton-secundario boton-chico" type="submit">
                    Salir
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
        {enlaces?.length ? <Navegacion enlaces={enlaces} /> : null}
      </header>
      <main id="contenido" tabIndex={-1}>
        {children}
      </main>
      <footer className="pie">
        <div className="pie-logos">
          <div className="contenedor">
            <div className="logos">
              <Image src={logoEducacion} alt="Educación Pública, Ministerio de Educación" />
              <Image src={logoAconcagua} alt="Servicio Local de Educación Pública Aconcagua: San Felipe, Catemu, Llay Llay, Panquehue, Putaendo y Santa María" />
            </div>
            <p className="pie-contacto">
              ¿Dudas sobre tus días? Escribe a
              <br />
              <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>
            </p>
          </div>
        </div>
        <div className="pie-barra">
          <div className="contenedor">Servicio Local de Educación Pública Aconcagua · Subdirección de Gestión y Desarrollo de Personas</div>
        </div>
      </footer>
    </>
  );
}
