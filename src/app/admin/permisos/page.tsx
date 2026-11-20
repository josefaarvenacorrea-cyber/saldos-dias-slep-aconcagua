import type { Metadata } from 'next';
import { Alerta } from '@/componentes/Alerta';
import { fechaCorta, fechaHoraChile } from '@/lib/fechas';
import { todosLosPermisos, TEXTO_ESTADO_PERMISO } from '@/lib/permisos';
import { horasTexto, nombreTipo, type TipoPermiso } from '@/lib/reglasPermisos';
import * as f from '@/lib/formato';
import { requerirAdmin } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Permisos solicitados' };

const ETIQUETA = {
  pendiente_jefatura: 'etiqueta-advertencia',
  autorizado: 'etiqueta-exito',
  rechazado: 'etiqueta-neutra',
} as const;

export default async function PermisosAdmin() {
  await requerirAdmin();
  const permisos = await todosLosPermisos();

  const autorizados = permisos.filter((p) => p.estado === 'autorizado');
  const pendientes = permisos.filter((p) => p.estado === 'pendiente_jefatura');
  const porTipo = new Map<TipoPermiso, number>();
  for (const p of autorizados) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);

  return (
    <div className="seccion">
      <h1>Permisos solicitados</h1>
      <p className="texto-grande">
        Permisos pedidos y firmados dentro de la plataforma. Los autorizados son los que hay que reflejar en las planillas
        y en la carga de GeoVictoria.
      </p>

      <div className="cifras seccion">
        <div className="cifra">
          <strong>{permisos.length}</strong>
          <span>solicitudes</span>
        </div>
        <div className="cifra">
          <strong>{autorizados.length}</strong>
          <span>autorizados</span>
        </div>
        <div className="cifra">
          <strong>{pendientes.length}</strong>
          <span>esperando jefatura</span>
        </div>
      </div>

      {!permisos.length ? (
        <Alerta tipo="info" titulo="Todavía no hay permisos solicitados aquí">
          <p>Van a aparecer a medida que los funcionarios los pidan en la plataforma.</p>
        </Alerta>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Funcionario(a)</th>
              <th>Jefatura</th>
              <th>Permiso</th>
              <th>Cantidad</th>
              <th>Fechas</th>
              <th>Estado</th>
              <th>Código</th>
              <th>Firmado</th>
            </tr>
          </thead>
          <tbody>
            {permisos.map((p) => {
              const primera = p.dias[0]?.fecha ?? null;
              const ultima = p.dias[p.dias.length - 1]?.fecha ?? null;
              return (
                <tr key={p.id}>
                  <td>
                    {p.ficha.nombre}
                    <br />
                    <span className="sub">{p.ficha.rutTexto}</span>
                  </td>
                  <td>{p.ficha.jefaturaNombre}</td>
                  <td>
                    {nombreTipo(p.tipo)}
                    {p.causal ? <span className="sub"> · {p.causal}</span> : null}
                  </td>
                  <td>
                    {p.tipo === 'compensatorio'
                      ? `${horasTexto(p.totalMinutos)} hrs (${p.horaDesde}–${p.horaHasta})`
                      : f.dias(p.totalDias)}
                  </td>
                  <td>
                    {primera ? fechaCorta(primera) : '—'}
                    {ultima && ultima !== primera ? ` al ${fechaCorta(ultima)}` : ''}
                  </td>
                  <td>
                    <span className={`etiqueta ${ETIQUETA[p.estado]}`}>{TEXTO_ESTADO_PERMISO[p.estado]}</span>
                  </td>
                  <td>{p.codigo}</td>
                  <td>{p.firmaJefatura ? fechaHoraChile(p.firmaJefatura.en) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
