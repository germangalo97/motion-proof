# Sonido

## De dónde sale

- Música y efectos con licencia de uso comercial verificada, o hechos por código (sintetizados). Anota la fuente y
  la licencia de cada uno en un `licencias.txt` del proyecto.
- Nada de voces ni canciones de terceros sin licencia.

## Sincronía

- Los tiempos del video (cuándo entra cada cosa, cada clic, cada corte) van en un solo archivo, y el sonido los lee
  de ahí. Así un golpe cae justo con el cambio de escena, y si cambia un tiempo cambian los dos.
- Una música a 120 pulsos por minuto da un pulso cada 30 cuadros a 60 por segundo: los cortes en múltiplos de 30
  caen con la música.

## Volumen

- Objetivo: −14 LUFS integrados (la medida de volumen estándar para redes y web) y un pico real de −1 dBTP como
  máximo. `volumen.mjs` lo hace en dos pasadas y `medir.mjs` lo confirma.
- El limitador de ffmpeg deja pasar picos entre muestras; por eso `volumen.mjs` apunta a −1,5 dBTP y no a −1.
- Los golpes cortos (platillos, palmas) se nivelan por su pico, no por su volumen medio: si no, suenan mucho más
  fuerte de lo que miden.
- Un parlante de celular casi no reproduce por debajo de 150 Hz. La música tiene que sostenerse con los medios, no
  solo con los graves.

## Antes de entregar

Una persona tiene que escuchar el video con auriculares y con el parlante del celular. Las mediciones no reemplazan
eso. Si nadie lo escuchó, dilo en la entrega.
