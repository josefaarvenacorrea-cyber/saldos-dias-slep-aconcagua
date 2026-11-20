import Image from 'next/image';
import logoMineduc from '../../public/logos/slep-aconcagua-institucional.png';
import logoAconcagua from '../../public/logos/aconcagua.png';
import { fechaCorta, fechaHoraChile } from '@/lib/fechas';
import * as f from '@/lib/formato';
import type { ActoFirma } from '@/lib/postergaciones';
import type { Permiso } from '@/lib/permisos';
import { CAUSALES_OTROS, esFinDeSemana, horasTexto, jornadaUnica } from '@/lib/reglasPermisos';

/** Casilla del formulario, marcada con una X igual que en el papel. */
function Casilla({ marcada }: { marcada: boolean }) {
  return <span className={`sp-chk${marcada ? ' marcada' : ''}`} aria-hidden="true" />;
}

function Opcion({ texto, marcada }: { texto: string; marcada: boolean }) {
  return (
    <span className="sp-opcion">
      <Casilla marcada={marcada} /> {texto}
    </span>
  );
}

function BloqueFirma({ acto, imagen, pie, sufijo, codigo }: { acto: ActoFirma | null; imagen?: string | null; pie: string; sufijo: string; codigo: string }) {
  return (
    <div className="sp-firma-mitad">
      <div className="sp-firma-img">
        {acto && imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="" />
        ) : (
          <span className="sp-sin-firma">sin firmar</span>
        )}
      </div>
      {acto ? (
        <div className="sp-acto">
          <strong>AUTORIZADO ELECTRÓNICAMENTE</strong>
          {acto.nombre} · RUN {acto.rut}
          <br />
          {fechaHoraChile(acto.en)} · <span className="sp-codigo">{codigo}-{sufijo}</span>
        </div>
      ) : null}
      <div className="sp-firma-pie">{pie}</div>
    </div>
  );
}

export interface FirmasPermiso {
  solicitud?: string | null;
  jefatura?: string | null;
}

export function DocumentoPermiso({ p, firmas = {} }: { p: Permiso; firmas?: FirmasPermiso }) {
  const habiles = p.dias.filter((d) => !esFinDeSemana(d.fecha));
  const primera = habiles[0]?.fecha ?? p.dias[0]?.fecha ?? null;
  const ultima = habiles[habiles.length - 1]?.fecha ?? p.dias[p.dias.length - 1]?.fecha ?? null;
  const porHoras = p.tipo === 'compensatorio';
  const jornada = p.tipo === 'goce' ? jornadaUnica(p.dias) : null;
  const mezclada = p.tipo === 'goce' && jornada === null && habiles.length > 1;
  const resuelto = p.estado !== 'pendiente_jefatura';

  return (
    <article className="sp-hoja" aria-label="Formulario de solicitud de permisos">
      <header className="sp-encabezado">
        <Image className="sp-logo-izq" src={logoMineduc} alt="Ministerio de Educación" />
        <span className="sp-titulo">FORMULARIO SOLICITUD DE PERMISOS</span>
        <Image className="sp-logo-der" src={logoAconcagua} alt="SLEP Aconcagua" />
      </header>

      <div className="sp-caja sp-identificacion">
        <div className="sp-fila">
          <div className="sp-celda">
            <span className="sp-k">Nombre Solicitante:</span>
            <span className="sp-v">{p.ficha.nombre}</span>
          </div>
          <div className="sp-celda">
            <span className="sp-k">RUN:</span>
            <span className="sp-v">{p.ficha.rutTexto}</span>
          </div>
        </div>
        <div className="sp-fila">
          <div className="sp-celda">
            <span className="sp-k">Cargo Solicitante:</span>
            <span className="sp-v">{p.ficha.cargo}</span>
          </div>
          <div className="sp-celda">
            <span className="sp-k">Grado:</span>
            <span className="sp-v">{p.ficha.grado}</span>
          </div>
        </div>
        <div className="sp-fila">
          <div className="sp-celda">
            <span className="sp-k">Fecha Solicitud:</span>
            <span className="sp-v">{fechaCorta(p.creadaEn.toISOString().slice(0, 10))}</span>
          </div>
          <div className="sp-celda">
            <span className="sp-k">Estamento:</span>
            <span className="sp-v">{p.ficha.estamento}</span>
          </div>
        </div>
        <div className="sp-fila">
          <div className="sp-celda">
            <span className="sp-k">Unidad de Dependencia:</span>
            <span className="sp-v">{p.ficha.unidad}</span>
          </div>
        </div>
        <div className="sp-fila">
          <div className="sp-celda">
            <span className="sp-k">Nombre de Jefatura:</span>
            <span className="sp-v">{p.ficha.jefaturaNombre}</span>
          </div>
        </div>
      </div>

      <div className="sp-columnas">
        <div className="sp-col-izq">
          <h3 className="sp-seccion">
            Permiso por solicitar
            <small>(marcar casilla con una x)</small>
          </h3>
          <div className="sp-caja sp-lista">
            <Opcion texto="Feriado Legal" marcada={p.tipo === 'feriado'} />
            <Opcion texto="Con goce de remuneraciones" marcada={p.tipo === 'goce'} />
            <Opcion texto="Descanso Compensatorio" marcada={p.tipo === 'compensatorio'} />
            <Opcion texto="Interferiado (horas por recuperar)" marcada={p.tipo === 'interferiado'} />
          </div>
        </div>
        <div className="sp-col-der">
          <div className="sp-otros-titulo">Otros Permisos</div>
          <div className="sp-caja sp-otros">
            {[CAUSALES_OTROS.slice(0, 3), CAUSALES_OTROS.slice(3)].map((grupo, i) => (
              <div key={i}>
                {grupo.map((c) => (
                  <Opcion
                    key={c}
                    texto={c === 'Otros' ? `Otros ${p.causal === 'Otros' && p.detalle ? p.detalle : '______'}` : c}
                    marcada={p.tipo === 'otros' && p.causal === c}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="sp-nota-cert">*Adjuntar certificado correspondiente</p>
        </div>
      </div>

      <h3 className="sp-seccion">
        Días a solicitar
        <small>(rellenar casilla)</small>
      </h3>
      <div className="sp-tres">
        <div className="sp-caja">
          <span className="sp-ranura sp-corta">{porHoras ? '—' : f.numero(p.totalDias)}</span> N Total de días
        </div>
        <div className="sp-caja">
          <span className="sp-ranura sp-ancha">{porHoras || !primera ? '—' : fechaCorta(primera)}</span> Desde
        </div>
        <div className="sp-caja">
          <span className="sp-ranura sp-ancha">{porHoras || !ultima ? '—' : fechaCorta(ultima)}</span> Hasta
        </div>
      </div>
      {mezclada ? (
        <p className="sp-detalle-dias">
          <strong>Detalle por día:</strong>{' '}
          {habiles
            .map((d) => `${fechaCorta(d.fecha)} ${d.jornada === 'completa' ? 'jornada completa' : d.jornada === 'am' ? '½ día AM' : '½ día PM'}`)
            .join(' · ')}
        </p>
      ) : null}
      {porHoras && primera ? (
        <p className="sp-detalle-dias">
          <strong>Fecha del descanso compensatorio:</strong> {fechaCorta(primera)}
        </p>
      ) : null}

      <h3 className="sp-seccion">
        Tipo de jornada <small>(sólo día administrativo)</small>
        <small>(marcar casilla con una x)</small>
      </h3>
      <div className="sp-caja sp-jornada">
        <Opcion texto="Completa" marcada={jornada === 'completa'} />
        <Opcion texto="1/2 Día AM" marcada={jornada === 'am'} />
        <Opcion texto="1/2 Día PM" marcada={jornada === 'pm'} />
      </div>

      <h3 className="sp-seccion">
        Horas por solicitar
        <small>(rellenar casilla)</small>
      </h3>
      <div className="sp-tres">
        <div className="sp-caja">
          <span className="sp-ranura sp-corta">{porHoras ? horasTexto(p.totalMinutos) : '—'}</span> N° Total de horas
        </div>
        <div className="sp-caja">
          <span className="sp-ranura sp-ancha">{porHoras ? p.horaDesde : '—'}</span> Desde
        </div>
        <div className="sp-caja">
          <span className="sp-ranura sp-ancha">{porHoras ? p.horaHasta : '—'}</span> Hasta
        </div>
      </div>

      <div className="sp-aprueba">
        <span className="sp-tri" aria-hidden="true">
          &#9654;
        </span>
        <span className="sp-aprueba-lab">Jefatura aprueba permiso</span>
        <span className="sp-si-no">
          <span>
            Sí
            <Casilla marcada={p.estado === 'autorizado'} />
          </span>
          <span>
            No
            <Casilla marcada={p.estado === 'rechazado'} />
          </span>
        </span>
      </div>

      <div className="sp-caja sp-firmas">
        <BloqueFirma acto={p.firmaSolicitud} imagen={firmas.solicitud} pie="Firma" sufijo="S" codigo={p.codigo} />
        <BloqueFirma acto={p.firmaJefatura} imagen={firmas.jefatura} pie="Nombre y Firma Jefatura" sufijo="J" codigo={p.codigo} />
      </div>

      {resuelto ? (
        <p className="sp-verificacion">
          Documento generado por la plataforma <strong>Mis días</strong> del Servicio Local de Educación Pública Aconcagua.
          Su autenticidad puede verificarse en <strong>/verificar</strong> con el código <strong>{p.codigo}</strong>. Cada
          firma se registró en el momento indicado y el documento no se modifica con posterioridad.
        </p>
      ) : null}

      <div className="sp-pie">
        <span className="sp-barra" />
        <span className="sp-marcas" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      </div>
    </article>
  );
}
