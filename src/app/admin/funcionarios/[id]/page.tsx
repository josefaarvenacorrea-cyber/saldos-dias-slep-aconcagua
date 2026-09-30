import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/componentes/Alerta';
import { VistaFicha } from '@/componentes/VistaFicha';
import { consulta } from '@/lib/db';
import { fichaDe } from '@/lib/datos';
import { fechaHoraChile } from '@/lib/fechas';
import { formatearRut } from '@/lib/rut';
import { requerirAdmin } from '@/lib/sesion';
import { cambiarCorreo, cambiarHabilitacion, desbloquear, restablecerClave } from '../../acciones';

export const metadata: Metadata = { title: 'Ficha de funcionario' };

const MENSAJES_OK: Record<string, string> = {
  clave: 'La contraseña quedó restablecida. La persona debe entrar con los 4 primeros dígitos de su RUT y crear una nueva.',
  desbloqueo: 'La cuenta quedó desbloqueada.',
  deshabilitada: 'La cuenta quedó deshabilitada: no podrá ingresar.',
  habilitada: 'La cuenta quedó habilitada.',
  correo: 'El correo quedó guardado.',
};
const MENSAJES_ERROR: Record<string, string> = {
  'correo-invalido': 'El correo no tiene un formato válido.',
  'correo-ocupado': 'Ese correo ya lo usa otra cuenta.',
};

interface Cuenta {
  id: number;
  rut: string;
  nombre: string | null;
  email: string | null;
  email_alt: string | null;
  email_manual: boolean;
  debe_cambiar: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | Date | null;
  deshabilitado: boolean;
  vigente: boolean;
  ultimo_ingreso: string | Date | null;
}

export default async function FichaFuncionario({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string; ok?: string; error?: string }> }) {
  await requerirAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const [c] = await consulta<Cuenta>(
    `select id, rut, nombre, email, email_alt, email_manual, debe_cambiar, intentos_fallidos, bloqueado_hasta, deshabilitado, vigente, ultimo_ingreso
     from usuarios where id = $1 and rol = 'funcionario'`,
    [Number(id)],
  );
  if (!c) notFound();
  const ficha = await fichaDe(c.rut);
  const bloqueada = c.bloqueado_hasta && new Date(c.bloqueado_hasta) > new Date();

  return (
    <div className="seccion">
      <p>
        <Link href="/admin/funcionarios">← Volver a funcionarios</Link>
      </p>
      <h1>{c.nombre || formatearRut(c.rut)}</h1>
      {sp.ok && MENSAJES_OK[sp.ok] ? <Alerta tipo="exito">{<p>{MENSAJES_OK[sp.ok]}</p>}</Alerta> : null}
      {sp.error && MENSAJES_ERROR[sp.error] ? <Alerta tipo="error">{<p>{MENSAJES_ERROR[sp.error]}</p>}</Alerta> : null}

      <section className="tarjeta seccion" aria-labelledby="titulo-cuenta">
        <h2 id="titulo-cuenta">Cuenta</h2>
        <dl className="lista-datos">
          <div>
            <dt>RUT</dt>
            <dd>{formatearRut(c.rut)}</dd>
          </div>
          <div>
            <dt>Correo para ingresar</dt>
            <dd>
              {c.email ?? <span className="etiqueta etiqueta-advertencia">Sin correo: no puede ingresar</span>}
              {c.email_alt ? <span className="sub"> · también puede usar {c.email_alt}</span> : null}
              {c.email_manual ? <span className="sub"> · puesto a mano</span> : null}
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              {!c.vigente ? 'Sin saldos vigentes (no puede ingresar)' : c.deshabilitado ? 'Deshabilitada' : bloqueada ? `Bloqueada hasta las ${fechaHoraChile(c.bloqueado_hasta!).split(' a las ')[1]}` : c.debe_cambiar ? 'Con contraseña inicial' : 'Activa'}
            </dd>
          </div>
          <div>
            <dt>Último ingreso</dt>
            <dd>{c.ultimo_ingreso ? fechaHoraChile(c.ultimo_ingreso) : 'Nunca'}</dd>
          </div>
        </dl>
        <div className="acciones" style={{ marginTop: 16 }}>
          <form action={restablecerClave}>
            <input type="hidden" name="id" value={c.id} />
            <button className="boton boton-secundario" type="submit">
              Restablecer contraseña
            </button>
          </form>
          {bloqueada ? (
            <form action={desbloquear}>
              <input type="hidden" name="id" value={c.id} />
              <button className="boton boton-secundario" type="submit">
                Desbloquear
              </button>
            </form>
          ) : null}
          <form action={cambiarHabilitacion}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="accion" value={c.deshabilitado ? 'habilitar' : 'deshabilitar'} />
            <button className={`boton ${c.deshabilitado ? 'boton-secundario' : 'boton-peligro'}`} type="submit">
              {c.deshabilitado ? 'Habilitar cuenta' : 'Deshabilitar cuenta'}
            </button>
          </form>
        </div>
        <details className="desplegable">
          <summary>Cambiar el correo para ingresar</summary>
          <form action={cambiarCorreo}>
            <input type="hidden" name="id" value={c.id} />
            <div className="campo">
              <label htmlFor="email">Correo</label>
              <span className="ayuda" id="ayuda-email">
                Queda fijo aunque subas otra Dotación. Déjalo vacío para volver a usar el correo de la Dotación.
              </span>
              <input id="email" name="email" type="email" className="entrada" defaultValue={c.email_manual ? (c.email ?? '') : ''} aria-describedby="ayuda-email" />
            </div>
            <button className="boton boton-primario" type="submit">
              Guardar correo
            </button>
          </form>
        </details>
      </section>

      <h2>Lo que ve esta persona</h2>
      <VistaFicha ficha={ficha} filtro={sp.tipo} rutaBase={`/admin/funcionarios/${c.id}`} />
    </div>
  );
}
