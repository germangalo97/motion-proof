// Utilidades compartidas: ejecutar ffmpeg/ffprobe con errores claros y leer argumentos de la línea de comandos.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BUFER = 64 * 1024 * 1024;

/** Ejecuta un programa. Si falla, lanza un error con el final de su salida (nunca falla en silencio). */
export const correr = (programa, args, opciones = {}) => {
  const r = spawnSync(programa, args, { encoding: "utf8", maxBuffer: BUFER, ...opciones });
  if (r.error) {
    throw new Error(`No se pudo ejecutar ${programa}: ${r.error.message}. ¿Está instalado y en el PATH?`);
  }
  if (r.status !== 0) {
    throw new Error(`${programa} falló (código ${r.status}):\n${(r.stderr ?? "").slice(-2000)}`);
  }
  return r;
};

/** Lo que ffmpeg informa al pasar la imagen de un video por unos filtros, sin guardar nada. */
export const registroDeFiltro = (video, filtros) =>
  correr("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vf", filtros, "-an", "-f", "null", "-"]).stderr;

/** Datos de un video con ffprobe. `contar` cuenta los cuadros uno por uno (más lento, exacto). */
export const sondear = (video, contar = false) =>
  JSON.parse(correr("ffprobe", ["-v", "error", ...(contar ? ["-count_frames"] : []), "-show_format", "-show_streams", "-of", "json", video]).stdout);

/**
 * Separa argumentos en posicionales y opciones `--clave valor`. Las claves de `banderas` no llevan valor.
 * Lanza un error si una opción no se conoce o le falta el valor.
 */
export const leerArgumentos = (args, { conValor = [], banderas = [] } = {}) => {
  const posicionales = [];
  const opciones = {};
  for (let i = 0; i < args.length; i += 1) {
    const actual = args[i];
    if (!actual.startsWith("--")) {
      posicionales.push(actual);
      continue;
    }
    const clave = actual.slice(2);
    if (banderas.includes(clave)) {
      opciones[clave] = true;
    } else if (conValor.includes(clave)) {
      const valor = args[i + 1];
      if (valor === undefined || valor.startsWith("--")) {
        throw new Error(`Falta el valor de --${clave}`);
      }
      opciones[clave] = valor;
      i += 1;
    } else {
      throw new Error(`Opción desconocida: --${clave}`);
    }
  }
  return { posicionales, opciones };
};

/** Número positivo de una opción, o el valor por defecto. Lanza un error si no es un número válido. */
export const numero = (texto, porDefecto, nombre) => {
  if (texto === undefined) {
    return porDefecto;
  }
  const n = Number(texto);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--${nombre} tiene que ser un número mayor que 0 (llegó «${texto}»)`);
  }
  return n;
};

export const exigirArchivo = (archivo) => {
  if (!archivo || !fs.existsSync(archivo)) {
    throw new Error(`No existe el archivo: ${archivo}`);
  }
  return path.resolve(archivo);
};

/** Crea la carpeta de un archivo de salida y devuelve su ruta absoluta. */
export const prepararSalida = (archivo) => {
  const ruta = path.resolve(archivo);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  return ruta;
};

export const guardarJson = (archivo, datos) => {
  fs.writeFileSync(prepararSalida(archivo), `${JSON.stringify(datos, null, 1)}\n`, "utf8");
};

/** Envuelve el programa principal: cualquier error sale por stderr con código 1. */
export const principal = (nombre, fn) => {
  try {
    const codigo = fn();
    process.exitCode = codigo ?? 0;
  } catch (error) {
    process.stderr.write(`ERROR ${nombre}: ${error.message}\n`);
    process.exitCode = 1;
  }
};
