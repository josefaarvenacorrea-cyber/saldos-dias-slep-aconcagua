import type { Metadata, Viewport } from 'next';
import { Roboto, Roboto_Slab } from 'next/font/google';
import './globals.css';

const sans = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--fuente-sans', display: 'swap' });
const slab = Roboto_Slab({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--fuente-slab', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Mis días · SLEP Aconcagua', template: '%s · Mis días · SLEP Aconcagua' },
  description: 'Consulta de días administrativos, feriado legal y descansos complementarios del SLEP Aconcagua.',
  robots: { index: false, follow: false },
  icons: { icon: '/icono.svg' },
};

export const viewport: Viewport = { themeColor: '#092039', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${sans.variable} ${slab.variable}`}>
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
