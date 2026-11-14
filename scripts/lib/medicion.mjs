// Lógica de la medición: leer lo que devuelve ffmpeg y decidir si el video cumple. Sin efectos: se puede probar sola.

/** Umbrales. Cambiarlos solo con un motivo medido, nunca para que un video «pase». */
export const UMBRALES = {
  /** Diferencia permitida entre la duración pedida y la real. */
  toleranciaDuracionS: 0.05,
  /** Volumen integrado para redes y web: −14 LUFS ± 1. */
  lufs: { objetivo: -14, tolerancia: 1 },
  /** Pico real máximo. Más alto que esto distorsiona al recomprimir (YouTube, Instagram, el celular). */
  picoMaxDbtp: -1,
  /** Luminancia (0 a 1) por debajo de la cual un píxel cuenta como negro. Un fondo «casi negro» de diseño (#0e0e10) da ~0,055. */
  umbralNegro: 0.03,
  /** Un fundido desde o hacia negro en el primer o el último tramo se permite si dura hasta esto. */
  fundidoMaxS: 1,
  /** Distancia al principio o al final para considerar que un tramo negro es un fundido de borde. */
  bordeS: 0.05,
  /**
   * Quietud. Se mide sobre una copia en grises achicada 6 veces, así el grano de película (que cambia en todos los
   * cuadros) se promedia. `niveles` es el cambio medio máximo, sobre 256, para considerar «igual» a dos cuadros.
   *   - duplicado:  cuadros seguidos iguales durante 0,25 s o más. Es un render trabado. Falla.
   *   - sin_cambio: mirando una muestra cada 0,25 s, la imagen no cambia durante 0,5 s o más. Falla.
   *   - pausa:      cambia muy poco durante 0,25 s o más. Es movimiento lento; se informa, no falla.
   */
  achique: 6,
  quietud: {
    duplicado: { niveles: 0.05, segundos: 0.25, muestrasPorSegundo: null },
    sin_cambio: { niveles: 0.1, segundos: 0.5, muestrasPorSegundo: 4 },
    pausa: { niveles: 0.3, segundos: 0.25, muestrasPorSegundo: null },
  },
};

const NIVELES_DE_GRIS = 256;

/** Filtros de ffmpeg para medir un criterio de quietud. */
export const filtroDeQuietud = ({ niveles, segundos, muestrasPorSegundo }) => {
  const muestreo = muestrasPorSegundo ? `,fps=${muestrasPorSegundo}` : "";
  return `scale=iw/${UMBRALES.achique}:ih/${UMBRALES.achique}:flags=area,format=gray${muestreo},freezedetect=n=${niveles / NIVELES_DE_GRIS}:d=${segundos}`;
};

export const filtroDeNegros = () => `blackdetect=d=0.03:pix_th=${UMBRALES.umbralNegro}:pic_th=0.98`;

/** Volumen integrado y pico real del resumen final de `ebur128=peak=true`. NaN si no está. */
export const leerVolumen = (registro) => {
  const resumen = registro.slice(Math.max(0, registro.lastIndexOf("Summary:")));
  const numero = (re) => Number(re.exec(resumen)?.[1] ?? Number.NaN);
  return { lufs: numero(/I:\s+(-?[\d.]+) LUFS/), pico: numero(/Peak:\s+(-?[\d.]+) dBFS/) };
};

export const leerNegros = (registro) =>
  [...registro.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({ desde: Number(m[1]), hasta: Number(m[2]) }));

/** Tramos de `freezedetect`. Un tramo que no termina llega hasta el final del video. */
export const leerTramosQuietos = (registro, duracion) => {
  const inicios = [...registro.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const finales = [...registro.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return inicios.map((desde, i) => ({ desde: redondear(desde), hasta: redondear(finales[i] ?? duracion) }));
};

const redondear = (n) => Number(n.toFixed(3));
const enSegundos = (tramos) => tramos.map((t) => `${t.desde.toFixed(2)}–${t.hasta.toFixed(2)} s`).join(", ");

/** Un tramo negro corto que toca el principio o el final es un fundido, no una falla. */
const esFundidoDeBorde = (tramo, duracion) => {
  const tocaBorde = tramo.desde <= UMBRALES.bordeS || tramo.hasta >= duracion - UMBRALES.bordeS;
  return tocaBorde && tramo.hasta - tramo.desde <= UMBRALES.fundidoMaxS;
};

/**
 * Lista de fallas (texto para una persona). Vacía = cumple.
 * `esperado`: { ancho, alto, fps, duracion, conSonido }.
 */
export const evaluar = (medido, esperado) => {
  const fallas = [];
  const { ancho, alto, fps, duracion, conSonido } = esperado;
  if (!(Math.abs(medido.duracion_s - duracion) <= UMBRALES.toleranciaDuracionS)) {
    fallas.push(`dura ${medido.duracion_s} s (se pidieron ${duracion})`);
  }
  if (medido.ancho !== ancho || medido.alto !== alto) {
    fallas.push(`mide ${medido.ancho}×${medido.alto} (se pidió ${ancho}×${alto})`);
  }
  if (medido.cuadros_por_segundo !== fps) {
    fallas.push(`va a ${medido.cuadros_por_segundo} cuadros por segundo (se pidieron ${fps})`);
  }
  const cuadrosEsperados = Math.round(duracion * fps);
  if (medido.cuadros !== cuadrosEsperados) {
    fallas.push(`tiene ${medido.cuadros} cuadros (se esperaban ${cuadrosEsperados})`);
  }
  if (medido.codec_de_imagen !== "h264" || medido.formato_de_pixel !== "yuv420p") {
    fallas.push(`formato ${medido.codec_de_imagen} / ${medido.formato_de_pixel} (se espera h264 / yuv420p; con yuvj420p falta configurar el color en bt709)`);
  }
  if (conSonido) {
    if (!medido.codec_de_sonido) {
      fallas.push("no tiene sonido");
    } else {
      const { objetivo, tolerancia } = UMBRALES.lufs;
      if (!(Math.abs(medido.lufs - objetivo) <= tolerancia)) {
        fallas.push(`volumen ${medido.lufs} LUFS (objetivo ${objetivo} ± ${tolerancia})`);
      }
      if (!(medido.pico_dbtp <= UMBRALES.picoMaxDbtp)) {
        fallas.push(`pico real ${medido.pico_dbtp} dBTP (máximo ${UMBRALES.picoMaxDbtp})`);
      }
    }
  }
  const negros = medido.pantallas_negras.filter((t) => !esFundidoDeBorde(t, medido.duracion_s));
  if (negros.length > 0) {
    fallas.push(`${negros.length} tramo(s) en negro: ${enSegundos(negros)}`);
  }
  if (medido.cuadros_duplicados.length > 0) {
    fallas.push(`${medido.cuadros_duplicados.length} tramo(s) con cuadros duplicados (render trabado): ${enSegundos(medido.cuadros_duplicados)}`);
  }
  if (medido.tramos_sin_cambio.length > 0) {
    fallas.push(`${medido.tramos_sin_cambio.length} tramo(s) donde la imagen no cambia: ${enSegundos(medido.tramos_sin_cambio)}`);
  }
  return fallas;
};
