# Revisión

Se revisa dos veces: con cuadros de prueba antes del render completo, y con el video terminado antes de entregar.

## Antes del render completo

Saca un cuadro de cada cambio de escena y de cada movimiento de cámara, y míralos:

- [ ] La tipografía correcta desde el cuadro 0, sin Times New Roman en ningún cuadro.
- [ ] Ningún texto encimado con otro, en ningún formato.
- [ ] Nada se sale del cuadro salvo lo que está saliendo a propósito (mira sobre todo los rincones).
- [ ] Los elementos repetidos (tarjetas, filas, tildes) entran de a uno.
- [ ] Los contadores tardan alrededor de 1 s y no saltan al número final.
- [ ] En vertical, textos y marca dentro de la zona segura.
- [ ] Los movimientos de cámara se leen sin marear.

## Con el video terminado

1. `node scripts/medir.mjs final.mp4 --ancho ... --alto ... --fps ... --duracion ...`
2. `node scripts/cuadros.mjs final.mp4 hoja.png --cantidad 12` y mira la hoja entera.
3. Escuchar el sonido con auriculares y con el parlante del celular. Si nadie lo escuchó, dilo en la entrega.

## Qué significa cada falla de medir.mjs y cómo se arregla

| Falla | Causa probable | Arreglo |
|---|---|---|
| Dura distinto o tiene otra cantidad de cuadros | `durationInFrames` o `fps` de la composición | Corregir la composición y volver a renderizar |
| Mide otro tamaño | `width` y `height` de la composición, o se renderizó otra | Renderizar la composición correcta |
| `yuvj420p` en vez de `yuv420p` | Falta configurar el color | `Config.setColorSpace("bt709")` en `remotion.config.ts` |
| Volumen fuera de −14 ± 1 LUFS | La música no se niveló | `volumen.mjs` |
| Pico por encima de −1 dBTP | Golpes o música saturada | `volumen.mjs` (limita los picos) o bajar ese golpe en la mezcla |
| Tramo en negro en el medio | Una escena vacía, un `from` o una duración mal calculada | Revisar la secuencia de esos segundos |
| Cuadros duplicados | El render se trabó o algo depende del tiempo real o de una caché | Revisar que todo salga del número de cuadro y volver a renderizar |
| La imagen no cambia | Una pausa demasiado quieta | Sumar deriva, crecimiento lento o empuje de cámara a ese tramo |

Las «pausas con movimiento lento» del informe no son fallas: dicen dónde están las pausas, para revisarlas a ojo.

## Sobre el medidor

Cambiar un umbral después de que el medidor marcó algo es sospechoso. Hazlo solo si una medición muestra que la falla
es falsa (por ejemplo, el grano de película que cambia todos los cuadros), y explícalo en la entrega.
