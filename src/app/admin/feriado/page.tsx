import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/componentes/Alerta';
import { feriadoPorVencerLista } from '@/lib/datos';
import { anioActualChile, diasHabilesRestantesDelAnio, fechaHoraChile, hoyChile } from '@/lib/fechas';
import * as f from '@/lib/formato';
import { requerirAdmin } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Feriado por vencer' };

export default async function FeriadoPorVencer() {
  await requerirAdmin();
  const r = await feriadoPorVencerLista();
  const anioActual = anioActualChile();
  const conDescuadre = r.personas.filter((p) => p.descuadre).length;

  return (
    <div className="seccion">
      <h1>Feriado legal por vencer</h1>
      <p className="texto-grande">
        Personas con días de feriado legal acumulados de años anteriores que aún no usan. Esos días no se pueden postergar: si no los toman antes del 31 de diciembre, los pierden. Lo usado
        en el año se descuenta primero de los días acumulados. Cada persona ve un aviso con sus días por vencer en Mis días.
      </p>

      {r.anio === null ? (
        <Alerta tipo="info" titulo="Todavía no hay una Base de Saldos de Días publicada">
          <p>
            <Link href="/admin/cargas">Ir a cargar datos</Link>
          </p>
        </Alerta>
      ) : r.anio !== anioActual ? (
        <Alerta tipo="advertencia" titulo={`La Base de Saldos de Días publicada es de ${r.anio}`}>
          <p>
            El aviso de feriado por vencer usa la base del año en curso. Sube la de {anioActual} para verlo. <Link href="/admin/cargas">Ir a cargar datos</Link>
          </p>
        </Alerta>
      ) : (
        <>
          <div className="cifras seccion">
            <div className="cifra">
              <strong>{r.conAcumulados}</strong>
              <span>tienen días acumulados de años anteriores</span>
            </div>
            <div className="cifra">
              <strong>{r.yaLosUsaron}</strong>
              <span>ya los usaron todos (pueden postergar los de {r.anio})</span>
            </div>
            <div className="cifra">
              <strong>{r.personas.length}</strong>
              <span>perderían días si no los toman</span>
            </div>
            <div className="cifra">
              <strong>{f.numero(r.total)}</strong>
              <span>días por vencer en total</span>
            </div>
            <div className="cifra">
              <strong>{diasHabilesRestantesDelAnio(hoyChile())}</strong>
              <span>días hábiles quedan en el año, desde mañana</span>
            </div>
          </div>

          {conDescuadre ? (
            <Alerta tipo="advertencia" titulo={conDescuadre === 1 ? '1 persona de la lista tiene un descuadre' : `${conDescuadre} personas de la lista tienen un descuadre`}>
              <p>
                Detalle uso y SALDOS no suman lo mismo. Los días por vencer se calculan con Detalle uso, igual que el saldo; conviene corregir el Excel antes de contactarlas.
              </p>
            </Alerta>
          ) : null}

          <p className="acciones">
            <a className="boton boton-terciario" href="/admin/feriado/descargar">
              Descargar en Excel
            </a>
          </p>
          <div className="tabla-contenedor">
            <table className="tabla">
              <caption className="oculto-visual">Personas que perderían días de feriado legal, de más a menos días</caption>
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Área</th>
                  <th scope="col" className="num">
                    Acumulados
                  </th>
                  <th scope="col" className="num">
                    Usados en {r.anio}
                  </th>
                  <th scope="col" className="num">
                    Por vencer
                  </th>
                  <th scope="col">Último ingreso</th>
                  <th scope="col">Revisar</th>
                </tr>
              </thead>
              <tbody>
                {r.personas.map((p) => (
                  <tr key={p.rutTexto}>
                    <td>
                      {p.id ? <Link href={`/admin/funcionarios/${p.id}`}>{p.nombre}</Link> : p.nombre}
                      <br />
                      <span className="sub">{p.email ?? 'Sin correo'}</span>
                    </td>
                    <td>{p.area || '—'}</td>
                    <td className="num">{f.numero(p.acumulado)}</td>
                    <td className="num">{f.numero(p.usados)}</td>
                    <td className="num">
                      <strong>{f.numero(p.porVencer)}</strong>
                    </td>
                    <td className="nowrap">{p.ultimoIngreso ? fechaHoraChile(p.ultimoIngreso) : <span className="etiqueta etiqueta-neutra">Nunca</span>}</td>
                    <td>
                      {p.descuadre ? (
                        <Link className="etiqueta etiqueta-advertencia" href={`/admin/alertas?q=${encodeURIComponent(p.rutTexto)}`}>
                          Descuadre
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!r.personas.length ? (
                  <tr>
                    <td colSpan={7}>Nadie pierde días: todas las personas ya usaron sus días acumulados de años anteriores.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
