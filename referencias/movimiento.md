# Movimiento

Las funciones citadas están en `plantilla/movimiento.ts`. Los tiempos van en cuadros a 60 por segundo.

## Lo que delata a la IA

Revisa esta lista antes de animar y otra vez antes de entregar. Cada punto es algo que vimos en videos generados sin
criterio de motion design.

1. Todo entra a la vez. Los elementos de un grupo tienen que entrar de a uno, con 2 a 4 cuadros de diferencia.
2. Movimientos a velocidad constante, que arrancan y frenan de golpe.
3. Pausas muertas. La escena termina de armarse y queda congelada, cuando un video bien hecho sigue respirando.
4. Textos que aparecen de golpe o desaparecen sin salida.
5. La cámara clavada durante todo el video.
6. Sin desenfoque de movimiento. Lo que se mueve rápido se ve recortado, como en una presentación.
7. Tipografía de reemplazo (Times New Roman) en algún cuadro, porque la fuente no terminó de cargar.
8. Cosas que se salen del cuadro o quedan encimadas en el formato vertical.
9. Volumen desparejo entre videos y cortes que no caen con la música.

## Curvas

| Curva | Para qué |
|---|---|
| `CURVA.frena` | Textos que suben dentro de su máscara. Llegan y frenan sin rebote. |
| `CURVA.rebote` o `resorte()` | Tarjetas, botones y etiquetas, que frenan y se pasan apenas. |
| `CURVA.acelera` | Salidas. |
| `CURVA.suave` | Cámara y paneos, que arrancan y frenan suave. |
| `CURVA.mano` | El cursor, que arranca suave y se pasa un poco al llegar. |
| `PAREJO` | Solo derivas lentas de fondo. Con una curva, la deriva frenaría antes de tiempo y dejaría el final quieto. |

## Tiempos

- Entradas de unos 30 cuadros (0,5 s) con un rebote leve.
- Salidas más rápidas que las entradas, de alrededor del 60 % (18 cuadros) y acelerando.
- El siguiente movimiento arranca antes de que el anterior termine de asentarse, en su último 20 %.
- Textos importantes, 90 cuadros (1,5 s) como mínimo. Contadores, unos 60 cuadros, frenando al final.
- Un paneo de cámara de lado a lado no dura menos de 0,8 s.

## Que nada quede quieto

- Lo que espera en pantalla deriva unos píxeles (`deriva()`, ±3 a 4 px) o crece apenas (escala 1 → 1,02).
- La cámara empuja siempre un poco, también en las pausas (`tramo(f, a, b, PAREJO)`).
- Las pausas llevan movimiento lento. Sin él, `medir.mjs` las marca como «la imagen no cambia», y tiene razón, porque
  en pantalla se ven como un video trabado.

## Cámara

- Un contenedor de cámara por escena, que se mueve entero. Agrupa lo que se mueve junto (como en After Effects con
  un objeto padre) y anima el grupo, no cada pieza.
- Los movimientos de cámara van con `CURVA.suave` y se definen con `claves()`, una tabla de [cuadro, valor].
- Acercarse a un punto empuja hacia afuera lo que está lejos de ese punto. Ponle un tope a cada acercamiento y
  míralo en cuadros de prueba. Un acercamiento de 7 % hacia la izquierda alcanza para sacar del cuadro algo que está
  en el rincón derecho.
- En vertical, las piezas ya ocupan casi todo el ancho, y cualquier acercamiento las mete en la zona de botones de la
  red social. Ahí la cámara se mueve menos.

## Clic y cursor

- Cada clic hunde el botón. La escala va de 1 a 0,96 y vuelve a 1 en 8 cuadros (`presion()`).
- El cursor nunca va en línea recta. Viaja en arco (`arco()`, con una curva de 0,15 de la distancia) y con `CURVA.mano`.

## Desenfoque de movimiento

- `HtmlInCanvasMotionBlur` de `@remotion/motion-blur` dibuja cada cuadro en varios instantes y los promedia. Con 8
  muestras y 180° de obturación se parece a una cámara de cine (ver `plantilla/Ejemplo.tsx`).
- Por eso todo tiene que aceptar números de cuadro con decimales.
- El grano y la viñeta van por fuera del desenfoque, porque adentro se promedian y desaparecen.
- Cuesta tiempo de render. En una PC de escritorio, un video de 30 s a 1920×1080 y 60 cuadros por segundo con 8
  muestras tardó unos 4 minutos por formato.

## Vertical (9:16)

- Se rearma con otra puesta, con otras posiciones, otros tamaños de texto y a veces otro orden. No se recorta del 16:9.
- Deja textos y marca lejos de los bordes, donde las redes ponen botones y descripciones. Una guía aproximada para
  1080×1920, tomada de guías de terceros, es poner el texto entre y = 230 e y = 1440, y entre x = 70 y x = 920 (a la
  derecha van los botones). Verifícalo en la red donde se va a publicar.
