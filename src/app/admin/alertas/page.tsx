import type { Metadata } from 'next';
import { alertasActivas, alertasDeCuentas, NOMBRE_ARCHIVO } from '@/lib/datos';
import { requerirAdmin } from '@/lib/sesion';
import type { Alerta, Nivel, TipoArchivo } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Alertas' };

const NIVELES: Record<Nivel, { texto: string; clase: string; orden: number }> = {
  alta: { texto: 'Alta', clase: 'etiqueta-error', orden: 0 },
  media: { texto: 'Media', clase: 'etiqueta-advertencia', orden: 1 },
  baja: { texto: 'Baja', clase: 'etiqueta-neutra', orden: 2 },
  seguimiento: { texto: 'Seguimiento', clase: 'etiqueta-info', orden: 3 },
};

export default async function Alertas({ searchParams }: { searchParams: Promise<{ nivel?: string; archivo?: string; q?: string }> }) {
  await requerirAdmin();
  const { nivel = '', archivo = '', q = '' } = await searchParams;
  const todas: Alerta[] = [...(await alertasActivas()), ...(await alertasDeCuentas())].sort(
    (a, b) => NIVELES[a.nivel].orden - NIVELES[b.nivel].orden || a.archivo.localeCompare(b.archivo) || a.hoja.localeCompare(b.hoja) || (a.fila ?? 0) - (b.fila ?? 0),
  );
  const texto = q.trim().toLowerCase();
  const lista = todas.filter(
    (a) =>
      (!nivel || a.nivel === nivel) &&
      (!archivo || a.archivo === archivo) &&
      (!texto || `${a.nombre} ${a.rut} ${a.alerta} ${a.detalle}`.toLowerCase().includes(texto)),
  );
  const parametros = new URLSearchParams({ ...(nivel && { nivel }), ...(archivo && { archivo }), ...(q && { q }) });

  return (
    <div className="seccion">
      <h1>Alertas de los datos</h1>
      <p className="texto-grande">
        Revisiones automáticas de los Excel publicados: datos repetidos, RUT mal escritos, descuadres entre hojas, saldos negativos y personas sin correo. Cada alerta indica la hoja y la
        fila para corregirla en el Excel.
      </p>
      <form className="filtros">
        <div className="campo">
          <label htmlFor="nivel">Prioridad</label>
          <select id="nivel" name="nivel" className="entrada" defaultValue={nivel}>
            <option value="">Todas</option>
            {(Object.keys(NIVELES) as Nivel[]).map((n) => (
              <option key={n} value={n}>
                {NIVELES[n].texto}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="archivo">Archivo</label>
          <select id="archivo" name="archivo" className="entrada" defaultValue={archivo}>
            <option value="">Todos</option>
            {(Object.keys(NOMBRE_ARCHIVO) as TipoArchivo[]).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_ARCHIVO[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" type="search" className="entrada" defaultValue={q} />
        </div>
        <button className="boton boton-secundario" type="submit">
          Filtrar
        </button>
        <a className="boton boton-terciario" href={`/admin/alertas/descargar?${parametros}`}>
          Descargar en Excel
        </a>
      </form>
      <p className="sub">
        {lista.length} de {todas.length} alertas.
      </p>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Prioridad</th>
              <th scope="col">Archivo / hoja</th>
              <th scope="col" className="num">
                Fila
              </th>
              <th scope="col">Persona</th>
              <th scope="col">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a, i) => (
              <tr key={i}>
                <td>
                  <span className={`etiqueta ${NIVELES[a.nivel].clase}`}>{NIVELES[a.nivel].texto}</span>
                </td>
                <td>
                  {NOMBRE_ARCHIVO[a.archivo]}
                  <br />
                  <span className="sub">{a.hoja}</span>
                </td>
                <td className="num">{a.fila ?? '—'}</td>
                <td>
                  {a.nombre || '—'}
                  {a.rut ? (
                    <>
                      <br />
                      <span className="sub">{a.rut}</span>
                    </>
                  ) : null}
                </td>
                <td>
                  <strong>{a.alerta}</strong>
                  {a.detalle ? (
                    <>
                      <br />
                      <span className="sub">{a.detalle}</span>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {!lista.length ? (
              <tr>
                <td colSpan={5}>No hay alertas con estos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
