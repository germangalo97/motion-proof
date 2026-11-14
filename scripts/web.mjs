// Versión liviana para web o para mandar por mensaje, con su póster (la imagen que se ve antes de darle play).
// Prueba compresiones de la más liviana a la más pesada y se queda con la primera que no pierde nitidez visible:
// la mide con VMAF (un medidor de calidad percibida de 0 a 100 que viene con ffmpeg) contra el original.
//
// Uso:
//   node web.mjs <master.mp4> <salida.mp4> [--poster poster.jpg] [--segundo 0] [--ancho 1280] [--fps 30] [--informe x.json]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { correr, exigirArchivo, guardarJson, leerArgumentos, numero, prepararSalida, principal } from "./lib/comun.mjs";

/** Compresiones a probar (crf: más bajo = más peso y más nitidez), de la más liviana a la más pesada. */
const ESCALERA_CRF = [28, 26, 24, 23, 22, 21, 20, 19, 18];
/** La vara: promedio ≥ 95 y el 1 % de cuadros peores ≥ 90. Por debajo, el grano y los degradés se ven lavados. */
const VARA = { promedio: 95, peores: 90 };
const PEOR_PARTE = 0.01;
const POR_DEFECTO = { ancho: 1280, fps: 30, segundo: 0 };
const REGISTRO = "vmaf.json";

const hayVmaf = () => correr("ffmpeg", ["-hide_banner", "-filters"]).stdout.includes("libvmaf");

const comprimir = (master, salida, crf, ancho, fps) =>
  correr("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", master, "-vf", `scale=${ancho}:-2:flags=lanczos,fps=${fps}`,
    "-c:v", "libx264", "-crf", String(crf), "-preset", "slow", "-profile:v", "main", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ac", "2", salida,
  ]);

/** VMAF de la liviana contra el master llevado a su mismo tamaño y cuadros por segundo. */
const calidad = (liviana, master, ancho, fps) => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "vmaf-"));
  try {
    const mismoReloj = "settb=AVTB,setpts=PTS-STARTPTS";
    const filtro =
      `[0:v]${mismoReloj}[liviana];[1:v]fps=${fps},scale=${ancho}:-2:flags=lanczos,${mismoReloj}[master];` +
      `[liviana][master]libvmaf=log_fmt=json:log_path=${REGISTRO}:n_threads=${Math.max(1, os.cpus().length - 1)}`;
    // El registro se escribe en una carpeta temporal propia: así no hay que escapar rutas de Windows en el filtro.
    correr("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", liviana, "-i", master, "-lavfi", filtro, "-an", "-f", "null", "-"], { cwd: carpeta });
    const puntajes = JSON.parse(fs.readFileSync(path.join(carpeta, REGISTRO), "utf8")).frames.map((c) => c.metrics.vmaf);
    if (puntajes.length === 0 || puntajes.some((p) => !Number.isFinite(p))) {
      throw new Error("VMAF no devolvió un puntaje por cuadro");
    }
    const ordenados = [...puntajes].sort((a, b) => a - b);
    const peores = ordenados.slice(0, Math.max(1, Math.round(ordenados.length * PEOR_PARTE)));
    const promedio = (lista) => lista.reduce((s, p) => s + p, 0) / lista.length;
    return { promedio: Number(promedio(puntajes).toFixed(2)), peores: Number(promedio(peores).toFixed(2)) };
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
};

principal("web", () => {
  const { posicionales, opciones } = leerArgumentos(process.argv.slice(2), { conValor: ["poster", "segundo", "ancho", "fps", "informe"] });
  if (posicionales.length !== 2) {
    throw new Error("uso: node web.mjs <master.mp4> <salida.mp4> [--poster p.jpg] [--segundo 0] [--ancho 1280] [--fps 30] [--informe x.json]");
  }
  if (!hayVmaf()) {
    throw new Error("este ffmpeg no trae libvmaf. Instala una versión «full» (por ejemplo las de gyan.dev en Windows o la de Homebrew en Mac)");
  }
  const master = exigirArchivo(posicionales[0]);
  const salida = prepararSalida(posicionales[1]);
  const ancho = Math.round(numero(opciones.ancho, POR_DEFECTO.ancho, "ancho"));
  const fps = numero(opciones.fps, POR_DEFECTO.fps, "fps");
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "version-web-"));
  const intentos = [];
  let elegido = null;
  try {
    for (const crf of ESCALERA_CRF) {
      const prueba = path.join(carpeta, `crf${crf}.mp4`);
      comprimir(master, prueba, crf, ancho, fps);
      const nota = calidad(prueba, master, ancho, fps);
      const intento = { crf, megas: Number((fs.statSync(prueba).size / 1e6).toFixed(2)), vmaf_promedio: nota.promedio, vmaf_1_por_ciento_peor: nota.peores };
      intentos.push(intento);
      process.stdout.write(`crf ${crf}: ${intento.megas} MB · VMAF ${nota.promedio} (1 % peor ${nota.peores})\n`);
      if (nota.promedio >= VARA.promedio && nota.peores >= VARA.peores) {
        fs.copyFileSync(prueba, salida);
        elegido = intento;
        break;
      }
    }
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
  if (!elegido) {
    throw new Error(`ninguna compresión llegó a la vara (promedio ${VARA.promedio}, 1 % peor ${VARA.peores}); revisa el master`);
  }
  if (opciones.poster) {
    const segundo = opciones.segundo === undefined ? POR_DEFECTO.segundo : Number(opciones.segundo);
    if (!Number.isFinite(segundo) || segundo < 0) {
      throw new Error(`--segundo inválido: ${opciones.segundo}`);
    }
    correr("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(segundo), "-i", master, "-frames:v", "1", "-vf", `scale=${ancho}:-2:flags=lanczos`, "-q:v", "3", prepararSalida(opciones.poster)]);
  }
  const informe = { master, salida, ancho, fps, vara: VARA, elegido, intentos };
  if (opciones.informe) {
    guardarJson(opciones.informe, informe);
  }
  process.stdout.write(`\n${salida}: crf ${elegido.crf}, ${elegido.megas} MB, VMAF ${elegido.vmaf_promedio} / ${elegido.vmaf_1_por_ciento_peor}\n`);
});
