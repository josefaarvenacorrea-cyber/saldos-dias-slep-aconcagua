import type { NextConfig } from 'next';

const cabecerasDeSeguridad = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Plataforma interna: que no aparezca en buscadores.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['exceljs', '@electric-sql/pglite'],
  async headers() {
    return [{ source: '/:path*', headers: cabecerasDeSeguridad }];
  },
};

export default nextConfig;
