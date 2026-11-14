// Pruebas de la lógica que decide si un video pasa o falla (sin ffmpeg: solo datos).
// Correr con: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluar, leerNegros, leerTramosQuietos, leerVolumen } from "../scripts/lib/medicion.mjs";

const ESPERADO = { ancho: 1920, alto: 1080, fps: 60, duracion: 30, conSonido: true };

const medidoBueno = () => ({
  duracion_s: 30,
  ancho: 1920,
  alto: 1080,
  cuadros_por_segundo: 60,
  cuadros: 1800,
  codec_de_imagen: "h264",
  formato_de_pixel: "yuv420p",
  codec_de_sonido: "aac",
  lufs: -14.1,
  pico_dbtp: -1.9,
  pantallas_negras: [],
  cuadros_duplicados: [],
  tramos_sin_cambio: [],
  pausas_con_movimiento_lento: [{ desde: 12, hasta: 12.4 }],
});

test("un video que cumple todo no tiene fallas (las pausas lentas solo se informan)", () => {
  assert.deepEqual(evaluar(medidoBueno(), ESPERADO), []);
});

test("duración fuera de tolerancia falla", () => {
  const fallas = evaluar({ ...medidoBueno(), duracion_s: 29.8 }, ESPERADO);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /dura 29\.8 s/);
});

test("tamaño, cuadros por segundo y cantidad de cuadros se controlan", () => {
  const fallas = evaluar({ ...medidoBueno(), ancho: 1280, alto: 720, cuadros_por_segundo: 30, cuadros: 900 }, ESPERADO);
  assert.equal(fallas.length, 3);
});

test("yuvj420p (rango completo, el que sale sin configurar el color) falla", () => {
  const fallas = evaluar({ ...medidoBueno(), formato_de_pixel: "yuvj420p" }, ESPERADO);
  assert.match(fallas.join(), /yuvj420p/);
});

test("volumen y pico fuera de rango fallan, y un NaN también", () => {
  assert.equal(evaluar({ ...medidoBueno(), lufs: -20 }, ESPERADO).length, 1);
  assert.equal(evaluar({ ...medidoBueno(), pico_dbtp: -0.2 }, ESPERADO).length, 1);
  assert.equal(evaluar({ ...medidoBueno(), lufs: Number.NaN }, ESPERADO).length, 1);
});

test("sin sonido falla salvo que se pida un video mudo", () => {
  const mudo = { ...medidoBueno(), codec_de_sonido: null, lufs: Number.NaN, pico_dbtp: Number.NaN };
  assert.deepEqual(evaluar(mudo, ESPERADO), ["no tiene sonido"]);
  assert.deepEqual(evaluar(mudo, { ...ESPERADO, conSonido: false }), []);
});

test("pantalla negra en el medio falla aunque sea corta", () => {
  const fallas = evaluar({ ...medidoBueno(), pantallas_negras: [{ desde: 10, hasta: 10.15 }] }, ESPERADO);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /negro/);
});

test("un fundido desde negro al principio o hacia negro al final se permite si es corto", () => {
  const conFundidos = { ...medidoBueno(), pantallas_negras: [{ desde: 0, hasta: 0.4 }, { desde: 29.5, hasta: 30 }] };
  assert.deepEqual(evaluar(conFundidos, ESPERADO), []);
  const largo = { ...medidoBueno(), pantallas_negras: [{ desde: 0, hasta: 1.6 }] };
  assert.equal(evaluar(largo, ESPERADO).length, 1);
});

test("cuadros duplicados y tramos sin cambio fallan", () => {
  const fallas = evaluar(
    { ...medidoBueno(), cuadros_duplicados: [{ desde: 5, hasta: 5.5 }], tramos_sin_cambio: [{ desde: 5, hasta: 6 }] },
    ESPERADO,
  );
  assert.equal(fallas.length, 2);
});

test("leerVolumen toma el resumen final de ebur128", () => {
  const registro = "[Parsed_ebur128_0] t: 1 ... I: -30.0 LUFS\nSummary:\n  Integrated loudness:\n    I:         -14.1 LUFS\n  True peak:\n    Peak:       -1.9 dBFS\n";
  assert.deepEqual(leerVolumen(registro), { lufs: -14.1, pico: -1.9 });
  const vacio = leerVolumen("");
  assert.ok(Number.isNaN(vacio.lufs) && Number.isNaN(vacio.pico));
});

test("leerNegros y leerTramosQuietos leen los tramos de ffmpeg", () => {
  const negros = "[blackdetect @ 0x1] black_start:1 black_end:1.5 black_duration:0.5\n";
  assert.deepEqual(leerNegros(negros), [{ desde: 1, hasta: 1.5 }]);
  const quietos = "lavfi.freezedetect.freeze_start: 2.5\nlavfi.freezedetect.freeze_duration: 1\nlavfi.freezedetect.freeze_end: 3.5\nlavfi.freezedetect.freeze_start: 8\n";
  assert.deepEqual(leerTramosQuietos(quietos, 10), [{ desde: 2.5, hasta: 3.5 }, { desde: 8, hasta: 10 }]);
});
