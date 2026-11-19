import type { Metadata } from 'next';
import { Marco } from '@/componentes/Marco';
import { Alerta } from '@/componentes/Alerta';
import { fechaHoraChile } from '@/lib/fechas';
import { porCodigo, TEXTO_ESTADO } from '@/lib/postergaciones';
import * as f from '@/lib/formato';
import { usuarioActual } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Verificar un documento' };

/**
 * Comprueba que un documento emitido por la plataforma es auténtico. No muestra el documento
 * completo ni datos de más: solo confirma que el código existe y qué firmas tiene.
 */
export default async function Verificar({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const u = await usuarioActual();
  const { codigo } = await searchParams;
  const buscado = (codigo ?? '').trim().toUpperCase();
  const p = buscado ? await porCodigo(buscado) : null;

  return (
    <Marco usuario={u}>
      <div className="contenedor">
        <div className="seccion">
          <h1>Verificar un documento</h1>
          <p className="texto-grande">
            Escribe el código que aparece al pie del documento para comprobar que fue emitido por esta plataforma y que no
            se modificó después.
          </p>

          <form method="get" className="filtros">
            <div className="campo">
              <label htmlFor="codigo">Código de verificación</label>
              <input id="codigo" name="codigo" type="text" defaultValue={buscado} placeholder="MD-2027-PABC123" required />
            </div>
            <div className="campo" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="boton" type="submit">
                Verificar
              </button>
            </div>
          </form>

          {buscado && !p ? (
            <Alerta tipo="error" titulo="No encontramos ese código">
              <p>
                Revisa que esté bien escrito. Si el documento dice ser de esta plataforma y el código no existe, no fue
                emitido aquí.
              </p>
            </Alerta>
          ) : null}

          {p ? (
            <>
              <Alerta
                tipo={p.estado === 'completa' ? 'exito' : 'info'}
                titulo={p.estado === 'completa' ? 'Documento auténtico' : 'El código existe, pero el trámite no está completo'}
              >
                <p>
                  Formulario de postergación de feriado legal de {p.ficha.nombre}, RUN {p.ficha.rutTexto}.{' '}
                  {TEXTO_ESTADO[p.estado]}.
                </p>
              </Alerta>

              <table className="tabla">
                <tbody>
                  <tr>
                    <th scope="row">Código</th>
                    <td>{p.codigo}</td>
                  </tr>
                  <tr>
                    <th scope="row">Año que se posterga</th>
                    <td>{p.anio}</td>
                  </tr>
                  <tr>
                    <th scope="row">Días solicitados</th>
                    <td>{f.dias(p.diasSolicitados)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Días que solicita acumular</th>
                    <td>{p.diasAcumular === null ? 'Sin declarar' : f.dias(p.diasAcumular)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Firma del funcionario (sección I)</th>
                    <td>{p.firmaSolicitud ? `${p.firmaSolicitud.nombre} · ${fechaHoraChile(p.firmaSolicitud.en)}` : 'Sin firmar'}</td>
                  </tr>
                  <tr>
                    <th scope="row">Firma de la jefatura (sección II)</th>
                    <td>{p.firmaJefatura ? `${p.firmaJefatura.nombre} · ${fechaHoraChile(p.firmaJefatura.en)}` : 'Sin firmar'}</td>
                  </tr>
                  <tr>
                    <th scope="row">Firma del funcionario (sección III)</th>
                    <td>{p.firmaAceptacion ? `${p.firmaAceptacion.nombre} · ${fechaHoraChile(p.firmaAceptacion.en)}` : 'Sin firmar'}</td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : null}
        </div>
      </div>
    </Marco>
  );
}
