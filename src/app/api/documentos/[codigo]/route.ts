import { NextResponse } from 'next/server';
import { pdfDePermiso, pdfDePostergacion, nombreArchivo } from '@/lib/pdf/generar';
import { permisoPorCodigo } from '@/lib/permisos';
import { porCodigo } from '@/lib/postergaciones';
import { usuarioActual } from '@/lib/sesion';
import { jefaturaDe } from '@/lib/jefaturas';
import { esIntegracion } from '@/lib/integracion';
import { auditar } from '@/lib/db';

/**
 * Entrega el PDF de un formulario, buscado por su código de verificación.
 *
 * Lo puede descargar el funcionario dueño, su jefatura, la administración, y los flujos de
 * Power Automate con el token del servicio. El PDF se arma al momento desde los datos congelados
 * de la solicitud, así que siempre sale igual.
 */

export async function GET(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  const limpio = codigo.replace(/\.pdf$/i, '').toUpperCase();

  const [permiso, postergacion] = await Promise.all([permisoPorCodigo(limpio), porCodigo(limpio)]);
  const doc = permiso ?? postergacion;
  if (!doc) return NextResponse.json({ error: 'No existe ese documento.' }, { status: 404 });

  const porToken = esIntegracion(req);
  if (!porToken) {
    const u = await usuarioActual();
    if (!u) return NextResponse.json({ error: 'Tienes que iniciar sesión.' }, { status: 401 });
    const esDueno = u.rut === doc.rut;
    const esJefatura = u.rut === doc.jefaturaRut;
    const esAdmin = u.rol === 'admin';
    // Una jefatura que heredó el equipo también puede verlo aunque no haya firmado ella.
    const aCargo = !esDueno && !esJefatura && !esAdmin ? (await jefaturaDe(doc.rut))?.rut === u.rut : false;
    if (!esDueno && !esJefatura && !esAdmin && !aCargo) {
      return NextResponse.json({ error: 'Este documento no es tuyo.' }, { status: 403 });
    }
  }

  const pdf = permiso ? await pdfDePermiso(permiso) : await pdfDePostergacion(postergacion!);
  await auditar(porToken ? 'integracion' : 'usuario', 'documento.descarga', { codigo: limpio });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombreArchivo(doc.ficha.nombre, limpio)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
