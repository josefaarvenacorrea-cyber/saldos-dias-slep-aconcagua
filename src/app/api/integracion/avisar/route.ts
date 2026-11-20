import { NextResponse } from 'next/server';
import { esIntegracion } from '@/lib/integracion';
import { permisoPorCodigo } from '@/lib/permisos';
import { porCodigo } from '@/lib/postergaciones';
import {
  avisarPermiso,
  avisarPermisoPendiente,
  avisarPostergacion,
  avisarPostergacionPendiente,
  avisarPostergacionPropuesta,
} from '@/lib/webhook';
import { auditar } from '@/lib/db';

/**
 * Vuelve a mandarle el aviso al flujo de Power Automate, para un documento ya emitido.
 *
 *   POST /api/integracion/avisar
 *   Authorization: Bearer <TOKEN_INTEGRACION>
 *   { "codigo": "ABC123" }
 *
 * Sirve para dos cosas: reintentar cuando el aviso automático falló, y recuperar los documentos
 * que se emitieron antes de que el flujo existiera. Los códigos pendientes se sacan de
 * /api/integracion/documentos.
 */

export async function POST(req: Request) {
  if (!esIntegracion(req)) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }
  let codigo = '';
  try {
    const cuerpo = (await req.json()) as { codigo?: unknown };
    codigo = String(cuerpo.codigo ?? '')
      .trim()
      .toUpperCase();
  } catch {
    return NextResponse.json({ error: 'Falta el cuerpo con el código.' }, { status: 400 });
  }
  if (!codigo) return NextResponse.json({ error: 'Falta el código del documento.' }, { status: 400 });

  const [permiso, postergacion] = await Promise.all([permisoPorCodigo(codigo), porCodigo(codigo)]);
  if (!permiso && !postergacion) {
    return NextResponse.json({ error: 'No existe ese documento.' }, { status: 404 });
  }

  // Se reenvía el aviso que corresponde al estado en que está el documento ahora, no siempre el de
  // cierre: una solicitud esperando firma vuelve a avisarle a quien le toca firmar.
  const enviado = permiso
    ? permiso.estado === 'pendiente_jefatura'
      ? await avisarPermisoPendiente(permiso.id)
      : await avisarPermiso(permiso.id)
    : postergacion!.estado === 'pendiente_jefatura'
      ? await avisarPostergacionPendiente(postergacion!.id)
      : postergacion!.estado === 'pendiente_funcionario'
        ? await avisarPostergacionPropuesta(postergacion!.id)
        : await avisarPostergacion(postergacion!.id);
  await auditar('integracion', 'integracion.avisar', { codigo, enviado });

  if (!enviado) {
    return NextResponse.json(
      {
        enviado: false,
        codigo,
        // Las dos razones posibles, para no tener que ir a mirar los registros.
        motivo: process.env.POWER_AUTOMATE_WEBHOOK_URL
          ? 'El proceso de este documento no está cerrado, o el flujo respondió con error.'
          : 'Falta configurar POWER_AUTOMATE_WEBHOOK_URL en Vercel.',
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ enviado: true, codigo });
}
