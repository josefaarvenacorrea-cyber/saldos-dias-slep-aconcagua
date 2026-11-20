'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { guardarMiFirma, type EstadoFirma } from '@/app/mi-firma/acciones';
import { Alerta } from './Alerta';

/**
 * Dibujar la firma con el mouse o el dedo, o subirla como imagen. Se guarda en la cuenta de la
 * persona y solo se estampa cuando ella confirma cada firma, nunca sola.
 */
export function CapturaFirma({ firmaGuardada }: { firmaGuardada: string | null }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const dibujando = useRef(false);
  const anterior = useRef<{ x: number; y: number } | null>(null);

  const [modo, setModo] = useState<'dibujar' | 'subir'>('dibujar');
  const [propuesta, setPropuesta] = useState<string | null>(null);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [estado, enviar, enviando] = useActionState<EstadoFirma, FormData>(guardarMiFirma, {});

  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#14213d';
    ctx.current = g;
  }, []);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = lienzo.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }

  function inicio(e: React.PointerEvent<HTMLCanvasElement>) {
    dibujando.current = true;
    setHayTrazo(true);
    anterior.current = punto(e);
    lienzo.current?.setPointerCapture(e.pointerId);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || !ctx.current || !anterior.current) return;
    const p = punto(e);
    ctx.current.beginPath();
    ctx.current.moveTo(anterior.current.x, anterior.current.y);
    ctx.current.lineTo(p.x, p.y);
    ctx.current.stroke();
    anterior.current = p;
  }

  function fin() {
    dibujando.current = false;
    anterior.current = null;
  }

  function limpiar() {
    const c = lienzo.current;
    if (c && ctx.current) ctx.current.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
    setPropuesta(null);
  }

  function usarDibujo() {
    if (!hayTrazo) {
      setAviso('Dibuja tu firma en el recuadro antes de guardarla.');
      return;
    }
    setAviso(null);
    setPropuesta(lienzo.current?.toDataURL('image/png') ?? null);
  }

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (archivo.size > 250_000) {
      setAviso('La imagen es muy pesada. Usa una de menos de 250 KB o dibuja tu firma.');
      return;
    }
    const lector = new FileReader();
    lector.onload = (ev) => {
      setAviso(null);
      setPropuesta(String(ev.target?.result ?? ''));
    };
    lector.readAsDataURL(archivo);
  }

  const mostrada = propuesta ?? firmaGuardada;

  return (
    <>
      <div className="pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'dibujar'}
          className={`pestana ${modo === 'dibujar' ? 'activa' : ''}`}
          onClick={() => setModo('dibujar')}
        >
          Dibujar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'subir'}
          className={`pestana ${modo === 'subir' ? 'activa' : ''}`}
          onClick={() => setModo('subir')}
        >
          Subir imagen
        </button>
      </div>

      {modo === 'dibujar' ? (
        <div>
          <canvas
            ref={lienzo}
            width={1040}
            height={340}
            className="lienzo-firma"
            aria-label="Recuadro para dibujar la firma"
            onPointerDown={inicio}
            onPointerMove={mover}
            onPointerUp={fin}
            onPointerLeave={fin}
            onPointerCancel={fin}
          />
          <div className="acciones-aviso" style={{ marginTop: 12 }}>
            <button type="button" className="boton boton-secundario boton-chico" onClick={limpiar}>
              Limpiar
            </button>
            <button type="button" className="boton boton-chico" onClick={usarDibujo}>
              Usar esta firma
            </button>
            <span className="sub">Dibuja con el mouse o con el dedo dentro del recuadro.</span>
          </div>
        </div>
      ) : (
        <div className="zona-subida">
          <p className="sub" style={{ margin: 0 }}>
            Sube una foto o un escaneo de tu firma, en PNG o JPG, de menos de 250 KB.
          </p>
          <input type="file" accept="image/png,image/jpeg" onChange={subir} aria-label="Archivo con tu firma" />
        </div>
      )}

      {aviso ? (
        <Alerta tipo="advertencia">
          <p>{aviso}</p>
        </Alerta>
      ) : null}
      {estado.error ? (
        <Alerta tipo="error">
          <p>{estado.error}</p>
        </Alerta>
      ) : null}

      {mostrada ? (
        <div className="vista-firma">
          <p className="sub" style={{ marginTop: 0 }}>
            {propuesta ? 'Así quedará tu firma' : 'Firma guardada en tu cuenta'}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mostrada} alt="Tu firma" />
        </div>
      ) : null}

      {propuesta ? (
        <form action={enviar} style={{ marginTop: 16 }}>
          <input type="hidden" name="imagen" value={propuesta} />
          <button className="boton" type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar mi firma'}
          </button>
        </form>
      ) : null}
    </>
  );
}
