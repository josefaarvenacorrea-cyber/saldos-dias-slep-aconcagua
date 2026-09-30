import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/componentes/Alerta';
import { alertasActivas, alertasDeCuentas, cargasActivas, listaFuncionarios, NOMBRE_ARCHIVO } from '@/lib/datos';
import { fechaHoraChile } from '@/lib/fechas';
import { requerirAdmin } from '@/lib/sesion';
import type { TipoArchivo } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Administración' };

export default async function Resumen({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  await requerirAdmin();
  const { clave } = await searchParams;
  const [cargas, funcionarios, alertas, cuentas] = await Promise.all([cargasActivas(), listaFuncionarios(), alertasActivas(), alertasDeCuentas()]);
  const vigentes = funcionarios.filter((f) => f.vigente);
  const conCorreo = vigentes.filter((f) => f.email);
  const ingresaron = vigentes.filter((f) => f.ultimo_ingreso);
  const pendientesClave = vigentes.filter((f) => f.debe_cambiar);
  const altas = [...alertas, ...cuentas].filter((a) => a.nivel === 'alta').length;
  const porTipo = new Map(cargas.map((c) => [c.tipo, c]));

  return (
    <div className="seccion">
      <h1>Administración</h1>
      {clave === 'ok' ? (
        <Alerta tipo="exito" titulo="Tu contraseña quedó guardada" />
      ) : null}
      {cargas.length < 3 ? (
        <Alerta tipo="advertencia" titulo="Faltan datos por cargar">
          <p>
            Para que los funcionarios vean su información sube los tres archivos: días, descansos complementarios y dotación (esta última trae los correos para ingresar).{' '}
            <Link href="/admin/cargas">Ir a cargar datos</Link>
          </p>
        </Alerta>
      ) : null}

      <div className="cifras seccion">
        <div className="cifra">
          <strong>{vigentes.length}</strong>
          <span>funcionarios con saldos</span>
        </div>
        <div className="cifra">
          <strong>{conCorreo.length}</strong>
          <span>pueden ingresar (tienen correo)</span>
        </div>
        <div className="cifra">
          <strong>{ingresaron.length}</strong>
          <span>ya ingresaron alguna vez</span>
        </div>
        <div className="cifra">
          <strong>{pendientesClave.length}</strong>
          <span>aún con contraseña inicial</span>
        </div>
        <div className="cifra">
          <strong>{altas}</strong>
          <span>
            <Link href="/admin/alertas?nivel=alta">alertas de prioridad alta</Link>
          </span>
        </div>
      </div>

      <h2>Datos publicados</h2>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Archivo</th>
              <th scope="col">Nombre del archivo subido</th>
              <th scope="col">Actualizado</th>
              <th scope="col" className="num">
                Alertas
              </th>
            </tr>
          </thead>
          <tbody>
            {(['dias', 'descansos', 'dotacion'] as TipoArchivo[]).map((t) => {
              const c = porTipo.get(t);
              return (
                <tr key={t}>
                  <td>{NOMBRE_ARCHIVO[t]}</td>
                  <td>{c ? c.archivo : <span className="etiqueta etiqueta-advertencia">Sin cargar</span>}</td>
                  <td className="nowrap">{c ? fechaHoraChile(c.subida_en) : '—'}</td>
                  <td className="num">{c ? <Link href={`/admin/alertas?archivo=${t}`}>{c.n_alertas}</Link> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="acciones" style={{ marginTop: 24 }}>
        <Link className="boton boton-primario" href="/admin/cargas">
          Cargar datos actualizados
        </Link>
        <Link className="boton boton-secundario" href="/admin/funcionarios">
          Ver funcionarios
        </Link>
      </p>
    </div>
  );
}
