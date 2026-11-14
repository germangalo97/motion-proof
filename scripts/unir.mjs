// Une el video renderizado (sin sonido) con la música o la mezcla. No recomprime la imagen.
//
// Uso: node unir.mjs <video.mp4> <sonido.wav|mp3|m4a> <salida.mp4>
// Después ejecuta volumen.mjs sobre la salida para dejar el volumen en −14 LUFS.
import { correr, exigirArchivo, leerArgumentos, prepararSalida, principal, sondear } from "./lib/comun.mjs";

const SONIDO_KBPS = "256k";
/** Diferencia de duración entre imagen y sonido que se avisa (segundos). */
const AVISO_DIFERENCIA_S = 0.1;

principal("unir", () => {
  const { posicionales } = leerArgumentos(process.argv.slice(2));
  if (posicionales.length !== 3) {
    throw new Error("uso: node unir.mjs <video.mp4> <sonido> <salida.mp4>");
  }
  const video = exigirArchivo(posicionales[0]);
  const sonido = exigirArchivo(posicionales[1]);
  const salida = prepararSalida(posicionales[2]);
  const durVideo = Number(sondear(video).format.duration);
  const durSonido = Number(sondear(sonido).format.duration);
  correr("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-i", sonido, "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", SONIDO_KBPS, "-ar", "48000", "-shortest", "-movflags", "+faststart", salida,
  ]);
  process.stdout.write(`${salida}\n`);
  if (Math.abs(durVideo - durSonido) > AVISO_DIFERENCIA_S) {
    process.stdout.write(
      `AVISO: la imagen dura ${durVideo.toFixed(2)} s y el sonido ${durSonido.toFixed(2)} s. Se cortó al más corto; ` +
        "revisa que el sonido esté pensado para esta duración.\n",
    );
  }
});
