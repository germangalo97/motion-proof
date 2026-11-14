---
name: motion-proof
description: Crea videos de lanzamiento y motion graphics de producto (de 15 a 60 s) con código en Remotion, con reglas de movimiento de motion designer y controles automáticos (cuadros trabados, pantallas negras, volumen, calidad para web) para que el resultado no parezca hecho por IA. Úsalo cuando pidan un video de lanzamiento, una animación de producto o de interfaz, motion graphics, o revisar un video ya renderizado.
---

# Motion Proof

Vas a hacer videos animados con código: cada cuadro sale de un programa (Remotion, que usa React). Lo que separa
un video con «cara de IA» de uno profesional está casi siempre en dos lugares: el movimiento (curvas, ritmo, pausas
que respiran) y la revisión (mirar cuadro por cuadro y medir). Este skill te da las dos cosas.

## Antes de empezar

1. Comprueba las herramientas: `node --version` (20 o más) y `ffmpeg -version`. Para la versión web hace falta un
   ffmpeg con libvmaf (`ffmpeg -filters` tiene que listar `libvmaf`).
2. Si no hay proyecto de Remotion, créalo con `npx create-video --yes --blank mi-video` y suma las skills oficiales
   con `npx remotion skills add`. Usa esas skills para dudas de la API de Remotion.
3. En `remotion.config.ts` agrega `Config.setColorSpace("bt709");`. Sin eso el video sale en rango completo
   (yuvj420p) y algunos reproductores cambian los colores.
4. Copia `plantilla/movimiento.ts` al proyecto (por ejemplo a `src/lib/movimiento.ts`) y mira `plantilla/Ejemplo.tsx`
   para el patrón: entradas escalonadas con resorte, deriva, empuje de cámara, clic y desenfoque de movimiento.
5. Los programas de `scripts/` se ejecutan con `node <carpeta de este skill>/scripts/<programa>.mjs`. No instalan nada.

## El proceso

1. **Brief.** Qué es el producto, para quién, qué tiene que hacer quien mira al final, formatos (16:9, 9:16, 1:1) y
   duración. Si falta algo importante, pregunta antes de seguir.
2. **Guion visual** con `referencias/guion-visual.md`: escenas con cuadro de inicio y de fin exactos que sumen la
   duración total. No animes hasta que el usuario lo apruebe.
3. **Un solo archivo de configuración** con textos, números, colores y tiempos. Un cambio de texto tiene que ser una
   línea, y los tiempos los leen la imagen y el sonido desde el mismo lugar.
4. **Animar** siguiendo `referencias/movimiento.md`. Lee primero la lista «Lo que delata a la IA».
5. **Cuadros de prueba** (`npx remotion still` o `renderStill`) en cada cambio de escena y en cada movimiento de
   cámara. Míralos antes del render completo. Acercar la cámara hacia un punto empuja hacia afuera lo que está lejos
   de ese punto: toda edición de cámara se revisa en cuadros.
6. **Render** en H.264 (yuv420p, bt709) a 60 cuadros por segundo. Vertical y cuadrado se rearman con otra puesta en
   escena, no se recortan del horizontal.
7. **Sonido** con `referencias/sonido.md`: `unir.mjs` para sumar la música y `volumen.mjs` para dejarla en −14 LUFS.
8. **Medir** con `medir.mjs`. Si falla, se arregla el video. El medidor solo se cambia si la falla es falsa y una
   medición lo demuestra; en ese caso, dilo en la entrega.
9. **Revisar a ojo** con `cuadros.mjs` (hoja de cuadros) y la lista de `referencias/revision.md`.
10. **Versión web** con `web.mjs`, si hace falta un archivo liviano.
11. **Entregar** los mp4, la medición y lo que no se pudo verificar (por ejemplo, si nadie escuchó el sonido).

## Reglas fijas

- Cada cuadro sale solo del número de cuadro, que puede traer decimales por el desenfoque de movimiento. Nada de
  `useState`, `setTimeout`, transiciones de CSS ni `Math.random()` sin semilla fija.
- La tipografía se carga antes del primer cuadro. Un cuadro en Times New Roman es una falla.
- Nada se mueve en línea recta ni a velocidad constante, y nada queda quieto del todo.
- Un texto importante queda al menos 1,5 s en pantalla. Un contador sube en alrededor de 1 s.
- Nada se sale del cuadro, salvo que esté saliendo a propósito.
- Lo que no se verificó se dice con esas palabras.

## Comandos

```
node scripts/medir.mjs video.mp4 --ancho 1920 --alto 1080 --fps 60 --duracion 30 --informe medicion.json
node scripts/cuadros.mjs video.mp4 hoja.png --cantidad 12
node scripts/cuadros.mjs video.mp4 cambios.png --segundos 4.5,9,15.2,22
node scripts/unir.mjs video-mudo.mp4 musica.wav con-sonido.mp4
node scripts/volumen.mjs con-sonido.mp4 final.mp4
node scripts/web.mjs final.mp4 web.mp4 --poster poster.jpg --segundo 28
```

`medir.mjs` sale con código 0 si cumple y 1 si no, y lista cada falla en texto. `cuadros.mjs` deja una imagen que
puedes abrir para revisar varios momentos del video de una vez. Agrega `--mudo` a `medir.mjs` para un video sin sonido.
