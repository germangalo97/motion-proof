# Motion Proof

Un skill para Claude Code que hace videos de lanzamiento y motion graphics de producto con código (Remotion), con
las reglas de movimiento de un motion designer y controles automáticos que revisan el video terminado. Pensado para
que el resultado no parezca hecho por IA.

Lo armé haciendo videos de lanzamiento sin saber animar: Claude escribe el código, y estas reglas y controles son lo
que aprendí para que el resultado no se vea hecho por IA.

## Qué trae

| Carpeta | Qué hay |
|---|---|
| `SKILL.md` | Las instrucciones que sigue Claude: el proceso de punta a punta y las reglas fijas. |
| `referencias/` | Movimiento (curvas, tiempos, cámara, lo que delata a la IA), guion visual, sonido y revisión. |
| `plantilla/` | `movimiento.ts`, las funciones de movimiento para Remotion, y `Ejemplo.tsx`, una escena que las usa. |
| `scripts/` | Programas que miden y preparan el video. Solo necesitan Node y ffmpeg. |
| `tests/` | Pruebas de los programas, con videos de prueba que se fabrican solos. |

Los programas:

- `medir.mjs`: duración, tamaño, cuadros, formato, volumen, pico, pantallas negras, cuadros trabados y pausas
  congeladas. Dice si el video cumple y, si no, qué falla.
- `cuadros.mjs`: una hoja con cuadros del video en los segundos que elijas, para revisar sin mirarlo entero.
- `unir.mjs`: suma la música al video sin recomprimir la imagen.
- `volumen.mjs`: deja el volumen en −14 LUFS y el pico por debajo de −1 dBTP (lo estándar para redes y web).
- `web.mjs`: una versión liviana que no pierde nitidez visible, medida con VMAF, más la imagen de portada.

## Qué no hace

- No garantiza un buen video. Te da un método y controles; la idea, el gusto y la revisión final siguen siendo tuyos.
- No genera imágenes, voces ni música.
- No escucha el sonido: lo mide. Alguien tiene que escucharlo.

## Requisitos

- [Claude Code](https://claude.com/claude-code), que requiere un plan pago.
- Node.js 20 o más (22 o más para correr las pruebas).
- ffmpeg. Para `web.mjs`, una versión que incluya libvmaf (las versiones «full» la traen).
- Un proyecto de Remotion. Si no tienes uno, el skill te indica cómo crearlo.

## Instalación

Copia esta carpeta entera a una de estas rutas:

- `~/.claude/skills/motion-proof/` para usarla en todos tus proyectos.
- `.claude/skills/motion-proof/` dentro de un proyecto, para usarla solo ahí.

Después pídele a Claude algo como: «Hazme un video de lanzamiento de 30 segundos para mi app de turnos».

## Cuánto consume

Medido en mis propias sesiones de Claude Code (noviembre de 2026):

- Un video de 30 s complejo (desenfoque de movimiento, sonido sincronizado, versión horizontal y vertical): unos
  880 mil tokens de salida, casi todos con Claude Fable 5.2.
- Cinco videos de 30 s más simples: unos 570 mil tokens de salida en total, con Claude Opus 5.5.

Un token es un pedazo de texto que escribe el modelo; cuánto te cuesta depende de tu plan.

## Pruebas

```
npm test
```

Fabrican clips cortos con ffmpeg (uno sano, uno trabado, uno con una pantalla negra) y comprueban que los programas
detecten cada caso.

## Licencias

- Este skill: MIT (ver `LICENSE`).
- Remotion tiene su propia licencia. Según la versión leída el 08/11/2026, es gratis para personas y empresas de
  hasta 3 personas; una empresa más grande necesita una licencia paga. Revísala en
  [remotion.dev/license](https://www.remotion.dev/license) antes de usarlo en una empresa, y de nuevo antes de pasar a
  la versión 5, que cambia la licencia.

## Créditos

- [Remotion](https://www.remotion.dev), el programa que convierte el código en video.

Hecho por Germán Galo · [youtube.com/@germangaloia](https://www.youtube.com/@germangaloia)
