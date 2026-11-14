// Hoja de cuadros: saca cuadros de un video en los segundos pedidos y los junta en una imagen, con el segundo
// escrito arriba de cada uno. Sirve para revisar a ojo (o para que Claude revise) sin mirar el video entero.
//
// Uso:
//   node cuadros.mjs <video.mp4> <hoja.png> [--segundos 0.5,3,7.25] [--cantidad 12] [--columnas 4] [--ancho 480]
// Sin --segundos, reparte --cantidad cuadros a lo largo del video.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { correr, exigirArchivo, leerArgumentos, numero, prepararSalida, principal, sondear } from "./lib/comun.mjs";

const POR_DEFECTO = { cantidad: 12, columnas: 4, ancho: 480 };
const TAMANO_DE_LETRA = 26;
/** Tipografías comunes por sistema, para escribir el segundo en cada cuadro. Si no hay ninguna, va sin rótulo. */
const TIPOGRAFIAS = [
  "C:/Windows/Fonts/arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
];

/** Ruta de tipografía escapada para el filtro drawtext de ffmpeg (los «:» de Windows se escapan). */
const tipografia = () => {
  const encontrada = TIPOGRAFIAS.find((t) => fs.existsSync(t));
  return encontrada ? encontrada.replace(/:/g, "\\:") : null;
};

const segundosPedidos = (opciones, duracion) => {
  if (opciones.segundos) {
    const lista = opciones.segundos.split(",").map((s) => Number(s.trim()));
    const malos = lista.filter((s) => !Number.isFinite(s) || s < 0 || s >= duracion);
    if (malos.length > 0) {
      throw new Error(`segundos fuera del video (dura ${duracion.toFixed(2)} s): ${malos.join(", ")}`);
    }
    return lista;
  }
  const cantidad = Math.round(numero(opciones.cantidad, POR_DEFECTO.cantidad, "cantidad"));
  return Array.from({ length: cantidad }, (_, i) => Number((((i + 0.5) * duracion) / cantidad).toFixed(2)));
};

/** Grilla con xstack: cada celda se ubica sumando anchos y altos de las anteriores. */
const disposicion = (total, columnas) =>
  Array.from({ length: total }, (_, i) => {
    const c = i % columnas;
    const f = Math.floor(i / columnas);
    const x = c === 0 ? "0" : Array.from({ length: c }, () => "w0").join("+");
    const y = f === 0 ? "0" : Array.from({ length: f }, () => "h0").join("+");
    return `${x}_${y}`;
  }).join("|");

principal("cuadros", () => {
  const { posicionales, opciones } = leerArgumentos(process.argv.slice(2), { conValor: ["segundos", "cantidad", "columnas", "ancho"] });
  if (posicionales.length !== 2) {
    throw new Error("uso: node cuadros.mjs <video.mp4> <hoja.png> [--segundos 0.5,3] [--cantidad 12] [--columnas 4] [--ancho 480]");
  }
  const video = exigirArchivo(posicionales[0]);
  const salida = prepararSalida(posicionales[1]);
  const duracion = Number(sondear(video).format.duration);
  const segundos = segundosPedidos(opciones, duracion);
  const columnas = Math.round(numero(opciones.columnas, POR_DEFECTO.columnas, "columnas"));
  const ancho = Math.round(numero(opciones.ancho, POR_DEFECTO.ancho, "ancho"));
  const letra = tipografia();

  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "hoja-de-cuadros-"));
  try {
    const sueltos = segundos.map((s, i) => {
      const rotulo = letra
        ? `,drawtext=fontfile='${letra}':text='${s.toFixed(2)} s':x=10:y=8:fontsize=${TAMANO_DE_LETRA}:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6`
        : "";
      const archivo = path.join(carpeta, `${String(i).padStart(3, "0")}.png`);
      correr("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(s), "-i", video, "-frames:v", "1", "-vf", `scale=${ancho}:-2${rotulo}`, archivo]);
      return archivo;
    });
    const filas = Math.ceil(sueltos.length / columnas);
    const vacias = filas * columnas - sueltos.length;
    const alto = Math.round((ancho * Number(sondear(sueltos[0]).streams[0].height)) / Number(sondear(sueltos[0]).streams[0].width));
    const entradas = sueltos.flatMap((a) => ["-i", a]);
    const relleno = Array.from({ length: vacias }, (_, k) => `color=c=black:s=${ancho}x${alto}:d=1[r${k}]`);
    const celdas = [...sueltos.map((_, i) => `[${i}:v]`), ...relleno.map((_, k) => `[r${k}]`)];
    const grafo = [...relleno, `${celdas.join("")}xstack=inputs=${celdas.length}:layout=${disposicion(celdas.length, columnas)}:fill=black[hoja]`].join(";");
    if (celdas.length === 1) {
      fs.copyFileSync(sueltos[0], salida);
    } else {
      correr("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...entradas, "-filter_complex", grafo, "-map", "[hoja]", "-frames:v", "1", salida]);
    }
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
  process.stdout.write(`${salida} (${segundos.length} cuadros: ${segundos.map((s) => `${s} s`).join(", ")})\n`);
  if (!letra) {
    process.stdout.write("AVISO: no encontré una tipografía para rotular; los cuadros van en el orden de la lista.\n");
  }
});
