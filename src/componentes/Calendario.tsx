import { FERIADOS, MESES, esFinDeSemana, hoyChile } from '@/lib/fechas';
import * as f from '@/lib/formato';
import type { Solicitud, TipoSolicitud } from '@/lib/tipos';

export const NOMBRE_TIPO: Record<TipoSolicitud, string> = {
  administrativo: 'Día administrativo',
  feriado_legal: 'Feriado legal',
  descanso: 'Descanso complementario',
  otro: 'Otro permiso',
};

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_SEMANA_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

interface Uso {
  tipo: TipoSolicitud;
  fraccion: number;
  texto: string;
}

/** Calendario del año: cada día tomado se pinta con el color de su tipo. */
export function Calendario({ anio, solicitudes }: { anio: number; solicitudes: Solicitud[] }) {
  const usos = new Map<string, Uso[]>();
  for (const s of solicitudes) {
    for (const u of s.reparto) {
      const texto = s.unidad === 'horas' ? `${NOMBRE_TIPO[s.tipo]}, ${f.horas(s.cantidad)}` : `${NOMBRE_TIPO[s.tipo]}${u.fraccion < 1 ? ', medio día' : ''}`;
      usos.set(u.fecha, [...(usos.get(u.fecha) ?? []), { tipo: s.tipo, fraccion: u.fraccion, texto }]);
    }
  }
  const hoy = hoyChile();
  const tipos = new Set(solicitudes.map((s) => s.tipo));

  return (
    <div>
      <ul className="leyenda" aria-label="Leyenda del calendario">
        {(['administrativo', 'feriado_legal', 'descanso', 'otro'] as const)
          .filter((t) => tipos.has(t) || t !== 'otro')
          .map((t) => (
            <li key={t}>
              <span className={`muestra m-${t.replace('_', '-')}`} aria-hidden="true" /> {NOMBRE_TIPO[t]}
            </li>
          ))}
        <li>
          <span className="muestra m-medio" aria-hidden="true" /> Medio día o algunas horas
        </li>
        <li>
          <span className="muestra m-feriado" aria-hidden="true" /> Feriado nacional
        </li>
        <li>
          <span className="muestra m-hoy" aria-hidden="true" /> Hoy
        </li>
      </ul>
      <div className="meses">
        {MESES.map((nombreMes, m) => {
          const primero = new Date(Date.UTC(anio, m, 1));
          const diasMes = new Date(Date.UTC(anio, m + 1, 0)).getUTCDate();
          const desfase = (primero.getUTCDay() + 6) % 7; // lunes = 0
          const celdas: (number | null)[] = [...Array(desfase).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
          while (celdas.length % 7) celdas.push(null);
          const semanas = Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
          return (
            <section className="mes" key={nombreMes} aria-labelledby={`mes-${m}`}>
              <h3 id={`mes-${m}`}>
                {nombreMes} {anio}
              </h3>
              <table>
                <thead>
                  <tr>
                    {DIAS_SEMANA.map((d, i) => (
                      <th key={i} scope="col">
                        <abbr title={DIAS_SEMANA_LARGO[i]}>{d}</abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((semana, i) => (
                    <tr key={i}>
                      {semana.map((dia, j) => {
                        if (!dia) return <td key={j} />;
                        const iso = `${anio}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                        const u = usos.get(iso);
                        const feriado = FERIADOS[iso];
                        const total = u?.reduce((a, x) => a + x.fraccion, 0) ?? 0;
                        const clases = ['dia'];
                        if (esFinDeSemana(iso)) clases.push('finde');
                        if (feriado) clases.push('feriado');
                        if (u) clases.push('uso', `t-${u[0].tipo}`);
                        if (u && total < 1) clases.push('medio');
                        if (iso === hoy) clases.push('hoy');
                        const etiqueta = [`${dia} de ${nombreMes}`, feriado ? `feriado: ${feriado}` : null, ...(u?.map((x) => x.texto) ?? []), iso === hoy ? 'hoy' : null]
                          .filter(Boolean)
                          .join('. ');
                        return (
                          <td key={j}>
                            <span className={clases.join(' ')} title={etiqueta} aria-label={etiqueta} role="img">
                              {dia}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
