/**
 * Escena de ejemplo: muestra las reglas en código. No es para usar tal cual; es para copiar el patrón.
 *   - Tarjetas que entran de a una (escalonado de 3 cuadros), con resorte y un rebote leve.
 *   - Nada queda quieto: cada tarjeta deriva unos píxeles y la cámara empuja parejo toda la escena.
 *   - Un clic con hundimiento. Salida más rápida que la entrada.
 *   - Desenfoque de movimiento real por fuera de todo (el grano y la viñeta, si los hay, van afuera del desenfoque).
 * Textos y colores salen de un objeto de configuración: un cambio de texto es una línea.
 */
import { HtmlInCanvasMotionBlur } from "@remotion/motion-blur";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { CURVA, DURA, PAREJO, deriva, presion, resorte, tramo } from "./movimiento";

const CONFIG = {
  colores: { fondo: "#0e0e10", tarjeta: "#1b1b1f", texto: "#f3f3e9", acento: "#ff830a" },
  /**
   * En un video real, carga tu tipografía antes del primer cuadro: con `loadFont()` de @remotion/google-fonts o de
   * @remotion/fonts (archivo propio en public/). Si no carga, Chrome usa Times New Roman y el video delata que nadie
   * lo revisó. Acá va una de sistema para que el ejemplo funcione sin instalar nada.
   */
  tipografia: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  tarjetas: ["Mensajes", "Agenda", "Cobros"],
  entraEn: 20,
  clicEn: 110,
  saleEn: 150,
  /** Cuánto se acerca la cámara a lo largo de la escena (3 %). */
  empujeDeCamara: 0.03,
} as const;

/** Instantes que se promedian por cuadro (más = más suave y más lento de renderizar). */
const MUESTRAS = 8;
/** 180° = cada cuadro «ve» la mitad del tiempo entre cuadros, como una cámara de cine. */
const OBTURADOR = 180;

interface TarjetaProps {
  indice: number;
  texto: string;
}

function Tarjeta({ indice, texto }: TarjetaProps) {
  const f = useCurrentFrame();
  const inicio = CONFIG.entraEn + indice * DURA.escalonado;
  const entra = resorte(f, inicio);
  const sale = tramo(f, CONFIG.saleEn + indice * 2, CONFIG.saleEn + indice * 2 + DURA.salida, CURVA.acelera);
  const d = deriva(f, indice, 3);
  const clic = indice === 1 ? presion(f, CONFIG.clicEn) : 1;
  return (
    <div
      style={{
        width: 420,
        padding: "32px 36px",
        borderRadius: 24,
        background: CONFIG.colores.tarjeta,
        color: CONFIG.colores.texto,
        fontFamily: CONFIG.tipografia,
        fontSize: 44,
        fontWeight: 700,
        opacity: tramo(f, inicio, inicio + 12) * (1 - sale),
        transform: `translate(${d.x}px, ${(1 - entra) * 60 + d.y - sale * 40}px) scale(${(0.94 + 0.06 * entra) * clic})`,
      }}
    >
      {texto}
    </div>
  );
}

function Escena() {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const camara = 1 + CONFIG.empujeDeCamara * tramo(f, 0, durationInFrames, PAREJO);
  return (
    <AbsoluteFill style={{ background: CONFIG.colores.fondo, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 40, transform: `scale(${camara})` }}>
        {CONFIG.tarjetas.map((texto, i) => (
          <Tarjeta key={texto} indice={i} texto={texto} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

export function Ejemplo() {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: CONFIG.colores.fondo }}>
      <HtmlInCanvasMotionBlur width={width} height={height} samples={MUESTRAS} shutterAngle={OBTURADOR}>
        <Escena />
      </HtmlInCanvasMotionBlur>
    </AbsoluteFill>
  );
}
