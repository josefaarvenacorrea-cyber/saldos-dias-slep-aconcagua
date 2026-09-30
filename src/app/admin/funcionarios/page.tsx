import type { Metadata } from 'next';
import Link from 'next/link';
import { listaFuncionarios } from '@/lib/datos';
import { fechaHoraChile } from '@/lib/fechas';
import * as f from '@/lib/formato';
import { formatearRut } from '@/lib/rut';
import { requerirAdmin } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Funcionarios' };

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function EstadoCuenta({ fila }: { fila: Awaited<ReturnType<typeof listaFuncionarios>>[number] }) {
  if (!fila.vigente) return <span className="etiqueta etiqueta-neutra">Sin saldos vigentes</span>;
  if (fila.deshabilitado) return <span className="etiqueta etiqueta-error">Deshabilitada</span>;
  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) return <span className="etiqueta etiqueta-error">Bloqueada</span>;
  if (!fila.email) return <span className="etiqueta etiqueta-advertencia">Sin correo</span>;
  if (!fila.ultimo_ingreso) return <span className="etiqueta etiqueta-neutra">No ha ingresado</span>;
  if (fila.debe_cambiar) return <span className="etiqueta etiqueta-info">Clave inicial</span>;
  return <span className="etiqueta etiqueta-exito">Activa</span>;
}

export default async function Funcionarios({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  await requerirAdmin();
  const { q = '', estado = '' } = await searchParams;
  const todos = await listaFuncionarios();
  const busqueda = sinTildes(q.trim());
  const lista = todos.filter((x) => {
    if (busqueda && !sinTildes(`${x.nombre ?? ''} ${x.rut} ${formatearRut(x.rut)} ${x.email ?? ''} ${x.area ?? ''}`).includes(busqueda)) return false;
    if (estado === 'sin-correo') return x.vigente && !x.email;
    if (estado === 'no-ingresan') return x.vigente && !x.ultimo_ingreso;
    if (estado === 'negativos') return x.vigente && [x.adm, x.fl, x.dc].some((v) => v !== null && Number(v) < 0);
    if (estado === 'no-vigentes') return !x.vigente;
    return true;
  });

  return (
    <div className="seccion">
      <h1>Funcionarios</h1>
      <form className="filtros" role="search">
        <div className="campo">
          <label htmlFor="q">Buscar por nombre, RUT, correo o área</label>
          <input id="q" name="q" className="entrada" defaultValue={q} type="search" />
        </div>
        <div className="campo">
          <label htmlFor="estado">Mostrar</label>
          <select id="estado" name="estado" className="entrada" defaultValue={estado}>
            <option value="">Todos</option>
            <option value="sin-correo">Sin correo (no pueden ingresar)</option>
            <option value="no-ingresan">Aún no ingresan</option>
            <option value="negativos">Con algún saldo negativo</option>
            <option value="no-vigentes">Sin saldos vigentes</option>
          </select>
        </div>
        <button className="boton boton-secundario" type="submit">
          Filtrar
        </button>
      </form>
      <p className="sub">
        {lista.length} de {todos.length} personas.
      </p>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">RUT</th>
              <th scope="col">Área</th>
              <th scope="col" className="num">
                Administrativos
              </th>
              <th scope="col" className="num">
                Feriado legal
              </th>
              <th scope="col" className="num">
                Descanso
              </th>
              <th scope="col">Cuenta</th>
              <th scope="col">Último ingreso</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((x) => (
              <tr key={x.id} className={x.vigente ? undefined : 'fila-inactiva'}>
                <td>
                  <Link href={`/admin/funcionarios/${x.id}`}>{x.nombre || '(sin nombre)'}</Link>
                </td>
                <td className="nowrap">{formatearRut(x.rut)}</td>
                <td>{x.area ?? '—'}</td>
                <td className="num">{x.adm !== null ? f.numero(Number(x.adm)) : '—'}</td>
                <td className="num">{x.fl !== null ? f.numero(Number(x.fl)) : '—'}</td>
                <td className="num">{x.dc !== null ? f.horas(Number(x.dc)) : '—'}</td>
                <td>
                  <EstadoCuenta fila={x} />
                </td>
                <td className="nowrap">{x.ultimo_ingreso ? fechaHoraChile(x.ultimo_ingreso) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
