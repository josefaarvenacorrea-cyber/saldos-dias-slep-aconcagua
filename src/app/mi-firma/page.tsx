import type { Metadata } from 'next';
import Link from 'next/link';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { CapturaFirma } from '@/componentes/CapturaFirma';
import { firmaDe } from '@/lib/firmas';
import { enlacesDe } from '@/lib/enlaces';
import { requerirUsuario } from '@/lib/sesion';
import { borrarMiFirma } from './acciones';

export const metadata: Metadata = { title: 'Mi firma' };


export default async function MiFirma() {
  const u = await requerirUsuario();
  const [firma, enlaces] = await Promise.all([firmaDe(u.id), enlacesDe(u.rut)]);

  return (
    <Marco usuario={u} enlaces={enlaces}>
      <div className="contenedor">
        <div className="seccion">
          <h1>Mi firma</h1>
          <p className="texto-grande">
            Se guarda una sola vez en tu cuenta y se usa para firmar tus solicitudes dentro de la plataforma.
          </p>

          <Alerta tipo="info" titulo="Tu firma nunca se estampa sola">
            <p>
              Se aplica únicamente cuando tú presionas firmar y confirmas, y de cada firma queda registro con tu nombre, tu
              RUN, la fecha, la hora y la dirección desde la que firmaste. Nadie más puede usar tu firma ni descargarla.
            </p>
          </Alerta>

          <CapturaFirma firmaGuardada={firma} />

          {firma ? (
            <form action={borrarMiFirma} style={{ marginTop: 24 }}>
              <button className="boton boton-secundario boton-chico" type="submit">
                Borrar mi firma
              </button>
            </form>
          ) : null}

          <p style={{ marginTop: 24 }}>
            <Link className="boton boton-secundario boton-chico" href="/mis-dias">
              Volver a Mis días
            </Link>
          </p>
        </div>
      </div>
    </Marco>
  );
}
