type Tipo = 'info' | 'exito' | 'advertencia' | 'error';

const ICONOS: Record<Tipo, React.ReactNode> = {
  info: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />,
  exito: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 15-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9Z" />,
  advertencia: <path d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z" />,
  error: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />,
};

/** Alerta del Kit Digital: borde de color, fondo claro e ícono. */
export function Alerta({ tipo = 'info', titulo, children }: { tipo?: Tipo; titulo?: string; children?: React.ReactNode }) {
  return (
    <div className={`alerta alerta-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <svg className="alerta-icono" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {ICONOS[tipo]}
      </svg>
      <div>
        {titulo ? (
          <p>
            <strong>{titulo}</strong>
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
