// Deja el volumen listo para redes y web: −14 LUFS integrados y pico real por debajo de −1 dBTP.
// Copia la imagen sin recomprimir y rehace solo el sonido, en dos pasadas (primero mide, después corrige).
//
// Uso: node volumen.mjs <entrada.mp4> <salida.mp4>
import { correr, exigirArchivo, leerArgumentos, prepararSalida, principal } from "./lib/comun.mjs";

const OBJETIVO_LUFS = -14;
/** Se pide −1,5 y no −1: la compresión AAC puede subir el pico unas décimas. */
const OBJETIVO_PICO = -1.5;
const RANGO = 11;
const SONIDO_KBPS = "256k";
/** Margen extra (dB) del limitador previo, para que la ganancia lineal no pase el pico objetivo. */
const MARGEN_LIMITADOR_DB = 0.7;

const leerJson = (registro) => {
  const inicio = registro.lastIndexOf("{");
  const fin = registro.lastIndexOf("}");
  if (inicio < 0 || fin < inicio) {
    throw new Error("loudnorm no devolvió su medición");
  }
  const datos = JSON.parse(registro.slice(inicio, fin + 1));
  for (const clave of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"]) {
    if (!Number.isFinite(Number(datos[clave]))) {
      throw new Error(`la medición de loudnorm no trae un «${clave}» válido (${datos[clave]}); ¿el audio está en silencio?`);
    }
  }
  return datos;
};

const base = `I=${OBJETIVO_LUFS}:TP=${OBJETIVO_PICO}:LRA=${RANGO}`;

const medir = (entrada, prefiltro) =>
  leerJson(correr("ffmpeg", ["-hide_banner", "-nostats", "-i", entrada, "-af", `${prefiltro}loudnorm=${base}:print_format=json`, "-f", "null", "-"]).stderr);

/**
 * Si subir hasta −14 LUFS haría pasar el pico, loudnorm deja de ser lineal y aplasta todo el sonido. En ese caso se
 * limitan solo los picos antes, lo justo, y la corrección sigue siendo lineal.
 */
const prefiltroPara = (m) => {
  const ganancia = OBJETIVO_LUFS - Number(m.input_i);
  if (Number(m.input_tp) + ganancia <= OBJETIVO_PICO) {
    return "";
  }
  const techoDb = OBJETIVO_PICO - ganancia - MARGEN_LIMITADOR_DB;
  return `alimiter=limit=${(10 ** (techoDb / 20)).toFixed(4)}:attack=4:release=60:level=0,`;
};

principal("volumen", () => {
  const { posicionales } = leerArgumentos(process.argv.slice(2));
  if (posicionales.length !== 2) {
    throw new Error("uso: node volumen.mjs <entrada.mp4> <salida.mp4>");
  }
  const entrada = exigirArchivo(posicionales[0]);
  const salida = prepararSalida(posicionales[1]);
  if (salida === entrada) {
    throw new Error("la salida tiene que ser un archivo distinto de la entrada");
  }
  const primera = medir(entrada, "");
  const prefiltro = prefiltroPara(primera);
  const m = prefiltro ? medir(entrada, prefiltro) : primera;
  if (Number(m.input_lra) === 0) {
    // Sonido de volumen parejo (rango 0): loudnorm no acepta el modo lineal con rango 0, pero ahí la corrección
    // lineal es solo una ganancia fija. Se aplica directo.
    const ganancia = (OBJETIVO_LUFS - Number(m.input_i)).toFixed(2);
    correr("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", entrada, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
      "-af", `${prefiltro}volume=${ganancia}dB`, "-ar", "48000", "-c:a", "aac", "-b:a", SONIDO_KBPS, "-movflags", "+faststart", salida,
    ]);
    process.stdout.write(`${salida}\nantes: ${primera.input_i} LUFS · volumen parejo: ganancia fija de ${ganancia} dB\nConfírmalo con medir.mjs: es la medición que cuenta.\n`);
    return;
  }
  const segunda = [
    `${prefiltro}loudnorm=${base}`,
    `measured_I=${m.input_i}`,
    `measured_TP=${m.input_tp}`,
    `measured_LRA=${m.input_lra}`,
    `measured_thresh=${m.input_thresh}`,
    `offset=${m.target_offset}`,
    "linear=true",
    "print_format=json",
  ].join(":");
  const resultado = leerJson(
    correr("ffmpeg", [
      "-hide_banner", "-nostats", "-y", "-i", entrada, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
      "-af", segunda, "-ar", "48000", "-c:a", "aac", "-b:a", SONIDO_KBPS, "-movflags", "+faststart", salida,
    ]).stderr,
  );
  if (resultado.normalization_type !== "linear") {
    throw new Error(
      `la corrección no quedó lineal (${resultado.normalization_type}). Suele pasar cuando la mezcla tiene picos ` +
        "muy por encima del resto; revisa la mezcla y vuelve a intentar",
    );
  }
  process.stdout.write(
    `${salida}\nantes: ${primera.input_i} LUFS, pico ${primera.input_tp} dBTP · limitador previo: ${prefiltro ? "sí" : "no"}` +
      ` · después (según loudnorm): ${resultado.output_i} LUFS, pico ${resultado.output_tp} dBTP\n` +
      "Confírmalo con medir.mjs: es la medición que cuenta.\n",
  );
});
