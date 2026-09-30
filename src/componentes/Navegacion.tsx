'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface Enlace {
  href: string;
  texto: string;
}

export function Navegacion({ enlaces }: { enlaces: Enlace[] }) {
  const ruta = usePathname();
  // La pestaña activa es la de ruta más larga que calza (así /admin/cargas no marca también /admin).
  const activa = enlaces
    .filter((e) => ruta === e.href || ruta.startsWith(`${e.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="navegacion" aria-label="Principal">
      <div className="contenedor">
        <ul>
          {enlaces.map((e) => (
            <li key={e.href}>
              <Link href={e.href} aria-current={e.href === activa ? 'page' : undefined}>
                {e.texto}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
