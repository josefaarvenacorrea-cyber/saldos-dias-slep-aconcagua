import Link from 'next/link';
import { Marco } from '@/componentes/Marco';

export default function NoEncontrada() {
  return (
    <Marco>
      <div className="contenedor seccion">
        <h1>No encontramos esta página</h1>
        <p>
          Revisa la dirección o vuelve al <Link href="/">inicio</Link>.
        </p>
      </div>
    </Marco>
  );
}
