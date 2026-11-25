import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/componentes/Alerta';
import { fechaCorta, fechaHoraChile } from '@/lib/fechas';
import { mapaJefaturas } from '@/lib/jefaturas';
import { TEXTO_MOTIVO } from '@/lib/nombres';
import { POSTERGACION_EN_LINEA, PROCESO_POSTERGACION } from '@/lib/postergacion';
import { TEXTO_ESTADO, todas } from '@/lib/postergaciones';
import * as f from '@/lib/formato';
import { formatearRut } from '@/lib/rut';
import { requerirAdmin } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Postergaciones' };

const ETIQUETA = {
  pendiente_jefatura: 'etiqueta-advertencia',
  pendiente_funcionario: 'etiqueta-advertencia',
  completa: 'etiqueta-exito',
  sin_postergacion: 'etiqueta-neutra',
  desistida: 'etiqueta-neutra',
} as const;

export default async function Postergaciones() {
  await requerirAdmin();
  const proc = PROCESO_POSTERGACION;
  const [solicitudes, jefaturas] = await Promise.all([todas(), mapaJefaturas()]);

  const completas = solicitudes.filter((p) => p.estado === 'completa');
  const diasAcumulados = completas.reduce((t, p) => t + (p.diasAcumular ?? 0), 0);
  const pendientes = solicitudes.filter((p) => p.estado.startsWith('pendiente'));

  // Personas cuya jefatura no se pudo identificar: no pueden iniciar el trámite hasta arreglarlo.
  const sinJefatura = [...jefaturas.sinResolver.entries()].map(([rut, x]) => ({
    rut,
    funcionario: jefaturas.nombreDe.get(rut) ?? '',
    jefaturaEscrita: x.nombre,
    motivo: x.motivo,
  }));

  return (
    <div className="seccion">
      <h1>Postergaciones de feriado legal {proc.anioAPostergar} → {proc.anioDestino}</h1>
      <p className="texto-grande">
        {POSTERGACION_EN_LINEA
          ? 'Trámite completo dentro de la plataforma.'
          : 'El trámite se hace en papel: el formulario se descarga en Word, se firma y llega por correo. Aquí quedan solo las solicitudes que alcanzaron a iniciarse en la plataforma.'}{' '}
        El proceso va del {fechaCorta(proc.inicio)} al {fechaCorta(proc.fin)}.
      </p>

      <div className="cifras seccion">
        <div className="cifra">
          <strong>{solicitudes.length}</strong>
          <span>solicitudes iniciadas</span>
        </div>
        <div className="cifra">
          <strong>{completas.length}</strong>
          <span>completas</span>
        </div>
        <div className="cifra">
          <strong>{pendientes.length}</strong>
          <span>en trámite</span>
        </div>
        <div className="cifra">
          <strong>{f.numero(diasAcumulados)}</strong>
          <span>días acumulados para {proc.anioDestino}</span>
        </div>
      </div>

      {sinJefatura.length ? (
        <Alerta tipo="advertencia" titulo={`${sinJefatura.length} personas sin jefatura identificada`}>
          <p>
            No pude emparejar lo que dice la columna JEFATURA de la Dotación con una persona, así que estas personas no
            pueden pedir permisos en la plataforma. Corrige el nombre en la Dotación y vuelve a subirla, o asígnale la jefatura a mano
            desde <Link href="/admin/funcionarios">Funcionarios</Link>.
          </p>
          <details className="desplegable">
            <summary>Ver el detalle</summary>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Funcionario(a)</th>
                  <th>Jefatura según la Dotación</th>
                  <th>Problema</th>
                </tr>
              </thead>
              <tbody>
                {sinJefatura.map((x) => (
                  <tr key={x.rut}>
                    <td>
                      {x.funcionario}
                      <br />
                      <span className="sub">{formatearRut(x.rut)}</span>
                    </td>
                    <td>{x.jefaturaEscrita}</td>
                    <td>{TEXTO_MOTIVO[x.motivo]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Alerta>
      ) : null}

      {!solicitudes.length ? (
        <Alerta tipo="info" titulo="Todavía no hay solicitudes">
          <p>
            {POSTERGACION_EN_LINEA
              ? 'Aquí van a aparecer a medida que los funcionarios inicien el trámite.'
              : 'Nadie alcanzó a iniciar el trámite en la plataforma, así que todas las postergaciones de este año llegan en papel.'}
          </p>
        </Alerta>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Funcionario(a)</th>
              <th>Jefatura</th>
              <th>Solicita</th>
              <th>Acumula</th>
              <th>Estado</th>
              <th>Código</th>
              <th>Última firma</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((p) => {
              const ultima = p.firmaAceptacion ?? p.firmaJefatura ?? p.firmaSolicitud;
              return (
                <tr key={p.id}>
                  <td>
                    {p.ficha.nombre}
                    <br />
                    <span className="sub">{p.ficha.rutTexto}</span>
                  </td>
                  <td>{p.ficha.jefaturaNombre}</td>
                  <td>{f.dias(p.diasSolicitados)}</td>
                  <td>{p.diasAcumular === null ? '—' : f.dias(p.diasAcumular)}</td>
                  <td>
                    <span className={`etiqueta ${ETIQUETA[p.estado]}`}>{TEXTO_ESTADO[p.estado]}</span>
                  </td>
                  <td>{p.codigo}</td>
                  <td>{ultima ? fechaHoraChile(ultima.en) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
