/**
 * Herramientas de movimiento para Remotion. Copiar este archivo al proyecto (por ejemplo a src/lib/movimiento.ts).
 *
 * Todo es función pura del número de cuadro, que puede venir con decimales: el desenfoque de movimiento dibuja cada
 * cuadro varias veces en instantes intermedios. Nada de estado, temporizadores ni transiciones de CSS.
 *
 * Probado con Remotion 4.0.541.
 */
import { Easing, interpolate } from "remotion";

export interface Punto {
  x: number;
  y: number;
}

/** Curvas de velocidad. Nada se mueve a velocidad constante, salvo las derivas lentas (ver PAREJO). */
export const CURVA = {
  /** Frena al llegar, sin rebote (textos que suben dentro de su máscara). */
  frena: Easing.bezier(0.16, 1, 0.3, 1),
  /** Frena y se pasa un poco (tarjetas, botones, etiquetas). */
  rebote: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Acelera (salidas: se van más rápido de lo que entraron). */
  acelera: Easing.bezier(0.5, 0, 0.75, 0),
  /** Arranca y frena suave (cámara, paneos). */
  suave: Easing.bezier(0.65, 0, 0.35, 1),
  /** Como una mano: arranca suave y se pasa apenas al llegar (cursor). */
  mano: Easing.bezier(0.5, 0, 0.2, 1.1),
} as const;

/**
 * Sin curva. Solo para derivas lentas de fondo (un texto que crece apenas mientras se lee, la cámara que empuja
 * durante una pausa): una curva frenaría antes de tiempo y dejaría el final quieto. Nunca para un movimiento.
 */
export const PAREJO = (t: number): number => t;

/** Duraciones base, en cuadros a 60 fps: entrada ~0,5 s, salida ~60 % de eso, el hundimiento de un clic. */
export const DURA = { entrada: 30, salida: 18, clic: 8, escalonado: 3 } as const;

const FIJO = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Avance de 0 a 1 entre los cuadros `a` y `b`, con la curva dada. Fuera del tramo queda en 0 o en 1. */
export const tramo = (f: number, a: number, b: number, curva: (t: number) => number = CURVA.frena): number =>
  interpolate(f, [a, b], [0, 1], { ...FIJO, easing: curva });

/** Interpolación con varios puntos clave, siempre acotada (para la cámara: [cuadro, valor], [cuadro, valor]...). */
export const claves = (
  f: number,
  cuadros: readonly number[],
  valores: readonly number[],
  curva: (t: number) => number = CURVA.suave,
): number => interpolate(f, cuadros, valores, { ...FIJO, easing: curva });

export const mezcla = (a: number, b: number, t: number): number => a + (b - a) * t;
export const acotar = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/**
 * Resorte amortiguado (fórmula cerrada, sin simulación): 0 en `desde`, se pasa un poco de 1 y se asienta en ~30
 * cuadros. `omega` es la velocidad (radianes por segundo) y `zeta` cuánto frena (0,7 = un rebote leve).
 */
export const resorte = (f: number, desde: number, omega = 11, zeta = 0.7, fps = 60): number => {
  const t = (f - desde) / fps;
  if (t <= 0) {
    return 0;
  }
  const amortiguada = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(amortiguada * t) + ((zeta * omega) / amortiguada) * Math.sin(amortiguada * t));
};

/** Pulso que sube y baja (0 → 1 → 0) entre `desde` y `desde + dura`; el pico cae en `pico` (0 a 1 del tramo). */
export const pulso = (f: number, desde: number, dura: number, pico = 0.3): number => {
  const u = (f - desde) / dura;
  if (u <= 0 || u >= 1) {
    return 0;
  }
  return u < pico ? Math.sin(((u / pico) * Math.PI) / 2) : Math.cos((((u - pico) / (1 - pico)) * Math.PI) / 2) ** 2;
};

/** El hundimiento de un clic: la escala baja a `fondo` y vuelve en `DURA.clic` cuadros. */
export const presion = (f: number, clic: number, fondo = 0.96): number => 1 - (1 - fondo) * pulso(f, clic, DURA.clic, 0.4);

/** Punto de una curva de Bézier cuadrática. */
export const bezier2 = (a: Punto, c: Punto, b: Punto, u: number): Punto => {
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
};

/** Viaje en arco de `a` a `b` (el cursor nunca va en línea recta). `u` ya trae su curva de velocidad. */
export const arco = (a: Punto, b: Punto, u: number, curva = 0.15): Punto => {
  const control = { x: (a.x + b.x) / 2 - (b.y - a.y) * curva, y: (a.y + b.y) / 2 + (b.x - a.x) * curva };
  return bezier2(a, control, b, u);
};

/** Deriva lenta para que nada quede quieto del todo: ±`amplitud` px, distinta para cada `semilla`. */
export const deriva = (f: number, semilla: number, amplitud = 4): Punto => ({
  x: Math.sin(f * 0.021 + semilla * 1.7) * amplitud,
  y: Math.cos(f * 0.017 + semilla * 2.3) * amplitud,
});
