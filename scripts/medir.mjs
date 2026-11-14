// Mide un video terminado y dice si cumple. No lo modifica.
//
// Uso:
//   node medir.mjs <video.mp4> [--ancho 1920] [--alto 1080] [--fps 60] [--duracion 30] [--mudo] [--informe informe.json]
//
// Mide: duración, tamaño, cuadros por segundo, cantidad de cuadros, formato, volumen (LUFS), pico real (dBTP),
// pantallas negras, cuadros duplicados, tramos donde la imagen no cambia y pausas con movimiento lento.
// Sale con código 0 si cumple y 1 si no. Los umbrales y su porqué están en lib/medicion.mjs.
import path from "node:path";

import { correr, exigirArchivo, guardarJson, leerArgumentos, numero, principal, registroDeFiltro, sondear } from "./lib/comun.mjs";
import { UMBRALES, evaluar, filtroDeNegros, filtroDeQuietud, leerNegros, leerTramosQuietos, leerVolumen } from "./lib/medicion.mjs";

const POR_DEFECTO = { ancho: 1920, alto: 1080, fps: 60, duracion: 30 };

principal("medir", () => {
  const { posicionales, opciones } = leerArgumentos(process.argv.slice(2), {
    conValor: ["ancho", "alto", "fps", "duracion", "informe"],
    banderas: ["mudo"],
  });
  if (posicionales.length !== 1) {
    throw new Error("uso: node medir.mjs <video.mp4> [--ancho 1920] [--alto 1080] [--fps 60] [--duracion 30] [--mudo] [--informe x.json]");
  }
  const video = exigirArchivo(posicionales[0]);
  const esperado = {
    ancho: numero(opciones.ancho, POR_DEFECTO.ancho, "ancho"),
    alto: numero(opciones.alto, POR_DEFECTO.alto, "alto"),
    fps: numero(opciones.fps, POR_DEFECTO.fps, "fps"),
    duracion: numero(opciones.duracion, POR_DEFECTO.duracion, "duracion"),
    conSonido: !opciones.mudo,
  };

  const sonda = sondear(video, true);
  const imagen = sonda.streams.find((s) => s.codec_type === "video");
  const sonido = sonda.streams.find((s) => s.codec_type === "audio");
  if (!imagen) {
    throw new Error("el archivo no tiene imagen");
  }
  const [num, den] = imagen.r_frame_rate.split("/").map(Number);
  const duracion = Number(sonda.format.duration);
  const volumen = sonido
    ? leerVolumen(correr("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr)
    : { lufs: Number.NaN, pico: Number.NaN };
  const quietos = (criterio) => leerTramosQuietos(registroDeFiltro(video, filtroDeQuietud(criterio)), duracion);

  const medido = {
    archivo: path.resolve(video),
    megas: Number((Number(sonda.format.size) / 1e6).toFixed(2)),
    duracion_s: Number(duracion.toFixed(4)),
    ancho: imagen.width,
    alto: imagen.height,
    cuadros_por_segundo: num / den,
    cuadros: Number(imagen.nb_read_frames ?? imagen.nb_frames),
    codec_de_imagen: imagen.codec_name,
    formato_de_pixel: imagen.pix_fmt,
    color: `${imagen.color_space ?? "sin dato"} / ${imagen.color_range ?? "sin dato"}`,
    codec_de_sonido: sonido?.codec_name ?? null,
    lufs: volumen.lufs,
    pico_dbtp: volumen.pico,
    pantallas_negras: leerNegros(registroDeFiltro(video, filtroDeNegros())),
    cuadros_duplicados: quietos(UMBRALES.quietud.duplicado),
    tramos_sin_cambio: quietos(UMBRALES.quietud.sin_cambio),
    pausas_con_movimiento_lento: quietos(UMBRALES.quietud.pausa),
  };
  medido.esperado = esperado;
  medido.fallas = evaluar(medido, esperado);
  medido.cumple = medido.fallas.length === 0;

  if (opciones.informe) {
    guardarJson(opciones.informe, medido);
  }
  process.stdout.write(`${JSON.stringify(medido, null, 1)}\n`);
  process.stdout.write(medido.cumple ? "\nCUMPLE\n" : `\nNO CUMPLE:\n- ${medido.fallas.join("\n- ")}\n`);
  return medido.cumple ? 0 : 1;
});
