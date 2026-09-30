import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/componentes/Alerta';
import { historialCargas, NOMBRE_ARCHIVO } from '@/lib/datos';
import { fechaHoraChile } from '@/lib/fechas';
import { requerirAdmin } from '@/lib/sesion';
import type { TipoArchivo } from '@/lib/tipos';
import { usarCarga } from '../acciones';

export const metadata: Metadata = { title: 'Cargar datos' };

const DESCRIPCION: Record<TipoArchivo, string> = {
  dias: 'Excel con las hojas SALDOS y Detalle uso. Se usa para días administrativos y feriado legal.',
  descansos: 'Excel con la hoja DESCANSOS COMPLEMENTARIOS, Detalle Uso y las hojas de resoluciones (REX).',
  dotacion: 'Excel de dotación efectiva. Se usan los datos laborales y los correos para ingresar.',
};

const ERRORES: Record<string, string> = {
  'sin-archivo': 'No se recibió ningún archivo. Elige el Excel y vuelve a intentarlo.',
  'no-xlsx': 'El archivo debe ser un Excel .xlsx.',
  'muy-grande': 'El archivo pesa más de 8 MB. Revisa que sea el correcto.',
  origen: 'La solicitud no vino de esta página. Vuelve a intentarlo.',
};

export default async function Cargas({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; detalle?: string; tipo?: string; alertas?: string }> }) {
  await requerirAdmin();
  const sp = await searchParams;
  const historial = await historialCargas();
  const tipoOk = sp.tipo as TipoArchivo | undefined;

  return (
    <div className="seccion">
      <h1>Cargar datos actualizados</h1>
      <p className="texto-grande">
        Sube el Excel actualizado y la plataforma se actualiza de inmediato. Solo se leen las hojas necesarias; el archivo original no se guarda.
      </p>

      {sp.ok === 'carga' && tipoOk && NOMBRE_ARCHIVO[tipoOk] ? (
        <Alerta tipo="exito" titulo={`${NOMBRE_ARCHIVO[tipoOk]} publicada`}>
          <p>
            Los funcionarios ya ven la información nueva.{' '}
            {Number(sp.alertas) > 0 ? (
              <>
                Se encontraron <Link href={`/admin/alertas?archivo=${tipoOk}`}>{sp.alertas} alertas</Link> para revisar en el Excel.
              </>
            ) : (
              'No se encontraron alertas.'
            )}
          </p>
        </Alerta>
      ) : null}
      {sp.ok === 'version' ? <Alerta tipo="exito" titulo="Se volvió a la versión elegida" /> : null}
      {sp.error ? (
        <Alerta tipo="error" titulo="No se pudo cargar el archivo">
          <p>{ERRORES[sp.error] ?? sp.detalle ?? 'Ocurrió un error inesperado.'}</p>
        </Alerta>
      ) : null}

      <div className="grilla grilla-3 seccion">
        {(['dias', 'descansos', 'dotacion'] as TipoArchivo[]).map((t) => (
          <form key={t} className="tarjeta" action="/admin/cargas/subir" method="post" encType="multipart/form-data">
            <h2>{NOMBRE_ARCHIVO[t]}</h2>
            <p className="sub">{DESCRIPCION[t]}</p>
            <input type="hidden" name="tipo" value={t} />
            <div className="campo">
              <label htmlFor={`archivo-${t}`}>Archivo Excel (.xlsx)</label>
              <input id={`archivo-${t}`} name="archivo" type="file" className="entrada" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
            </div>
            <button className="boton boton-primario boton-ancho" type="submit">
              Subir y publicar
            </button>
          </form>
        ))}
      </div>

      <h2>Historial de cargas</h2>
      <p className="sub">Si subiste un archivo equivocado, puedes volver a una versión anterior. Se guardan las últimas 40 de cada tipo.</p>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Tipo</th>
              <th scope="col">Archivo</th>
              <th scope="col">Subido por</th>
              <th scope="col" className="num">
                Personas
              </th>
              <th scope="col" className="num">
                Alertas
              </th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((c) => (
              <tr key={c.id}>
                <td className="nowrap">{fechaHoraChile(c.subida_en)}</td>
                <td>{NOMBRE_ARCHIVO[c.tipo]}</td>
                <td>{c.archivo}</td>
                <td>{c.subida_por}</td>
                <td className="num">{String(c.resumen?.funcionarios ?? '—')}</td>
                <td className="num">{c.n_alertas}</td>
                <td>
                  {c.activa ? (
                    <span className="etiqueta etiqueta-exito">Publicada</span>
                  ) : (
                    <form action={usarCarga}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="boton boton-terciario boton-chico" type="submit">
                        Volver a esta versión
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!historial.length ? (
              <tr>
                <td colSpan={7}>Todavía no se ha cargado ningún archivo.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
