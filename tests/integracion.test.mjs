// Pruebas con videos de verdad: se fabrican clips cortos con ffmpeg (uno sano, uno trabado, uno con un negro) y se
// pasan por los programas. Necesitan ffmpeg con libvmaf. Tardan unos segundos.
// Correr con: node --test tests/
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const CLIP = { ancho: 640, alto: 360, fps: 30, segundos: 4 };
/** Un tono parejo (rango de volumen 0) y uno que cambia de volumen a la mitad (rango mayor que 0, como una música). */
const TONO_PAREJO = `sine=frequency=440:duration=${CLIP.segundos},volume=0.1`;
const TONO_VARIABLE = `aevalsrc='if(lt(t,2),0.01,0.06)*sin(2*PI*440*t)':s=48000:d=${CLIP.segundos}`;
let carpeta;

const ffmpeg = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};

const programa = (nombre, args) => spawnSync(process.execPath, [path.join(SCRIPTS, nombre), ...args], { encoding: "utf8" });

/** Corre medir.mjs y devuelve el informe. */
const medir = (video, extra = []) => {
  const informe = path.join(carpeta, `${path.basename(video)}.json`);
  const r = programa("medir.mjs", [video, "--ancho", `${CLIP.ancho}`, "--alto", `${CLIP.alto}`, "--fps", `${CLIP.fps}`, "--duracion", `${CLIP.segundos}`, "--informe", informe, ...extra]);
  assert.ok(fs.existsSync(informe), r.stderr);
  return { codigo: r.status, ...JSON.parse(fs.readFileSync(informe, "utf8")) };
};

/** Un clip de prueba con imagen en movimiento constante (testsrc2) y un tono suave, más un filtro opcional. */
const fabricar = (nombre, filtroDeImagen, tono = TONO_PAREJO) => {
  const salida = path.join(carpeta, nombre);
  const fuente = `testsrc2=size=${CLIP.ancho}x${CLIP.alto}:rate=${CLIP.fps}:duration=${CLIP.segundos}`;
  ffmpeg([
    "-f", "lavfi", "-i", fuente, "-f", "lavfi", "-i", tono,
    "-filter_complex", `${filtroDeImagen ?? "[0:v]null[v]"};[1:a]anull[a]`, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", salida,
  ]);
  return salida;
};

before(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "prueba-motion-"));
});
after(() => {
  fs.rmSync(carpeta, { recursive: true, force: true });
});

for (const [caso, tono] of [["parejo", TONO_PAREJO], ["variable", TONO_VARIABLE]]) {
  test(`un clip sano con sonido ${caso} solo falla por volumen; después de volumen.mjs cumple todo`, () => {
    const crudo = fabricar(`sano-${caso}.mp4`, undefined, tono);
    const antes = medir(crudo);
    assert.equal(antes.codigo, 1);
    assert.equal(antes.fallas.length, 1, antes.fallas.join(" | "));
    assert.match(antes.fallas[0], /volumen/);

    const listo = path.join(carpeta, `sano-${caso}-volumen.mp4`);
    const r = programa("volumen.mjs", [crudo, listo]);
    assert.equal(r.status, 0, r.stderr);
    const despues = medir(listo);
    assert.deepEqual(despues.fallas, []);
    assert.equal(despues.codigo, 0);
  });
}

test("un segundo trabado se detecta como cuadros duplicados y tramo sin cambio", () => {
  const trabado = fabricar("trabado.mp4", "[0:v]split[a][b];[a][b]freezeframes=first=30:last=59:replace=30[v]");
  const m = medir(trabado, ["--mudo"]);
  assert.equal(m.codigo, 1);
  assert.equal(m.cuadros_duplicados.length, 1);
  assert.equal(m.tramos_sin_cambio.length, 1);
  assert.ok(Math.abs(m.cuadros_duplicados[0].desde - 1) < 0.1, JSON.stringify(m.cuadros_duplicados));
});

test("una pantalla negra en el medio falla", () => {
  const conNegro = fabricar("negro.mp4", "[0:v]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,1.2,1.5)'[v]");
  const m = medir(conNegro, ["--mudo"]);
  assert.equal(m.codigo, 1);
  assert.equal(m.pantallas_negras.length, 1);
  assert.match(m.fallas.join(), /negro/);
});

test("cuadros.mjs arma una hoja de 4 columnas", () => {
  const clip = fabricar("hoja.mp4");
  const hoja = path.join(carpeta, "hoja.png");
  const r = programa("cuadros.mjs", [clip, hoja, "--cantidad", "6", "--columnas", "4", "--ancho", "320"]);
  assert.equal(r.status, 0, r.stderr);
  const sonda = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", hoja], { encoding: "utf8" }).stdout);
  assert.equal(sonda.streams[0].width, 4 * 320);
  assert.equal(sonda.streams[0].height, 2 * 180);
});

test("web.mjs elige una compresión que pasa la vara de calidad y saca el póster", () => {
  const clip = fabricar("web.mp4");
  const salida = path.join(carpeta, "web-liviana.mp4");
  const poster = path.join(carpeta, "poster.jpg");
  const informe = path.join(carpeta, "web.json");
  const r = programa("web.mjs", [clip, salida, "--ancho", "320", "--fps", "30", "--poster", poster, "--segundo", "1", "--informe", informe]);
  assert.equal(r.status, 0, r.stderr);
  const datos = JSON.parse(fs.readFileSync(informe, "utf8"));
  assert.ok(datos.elegido.vmaf_promedio >= 95 && datos.elegido.vmaf_1_por_ciento_peor >= 90);
  assert.ok(fs.existsSync(salida) && fs.existsSync(poster));
});
