# Mates sin palabras — Zenón y la pizza

Vídeo vertical (1080×1920, 60 fps, 32 s) de divulgación matemática sin narrador ni diálogos:
la paradoja de Zenón contada con un monigote, una pizza y la serie
½ + ¼ + ⅛ + 1/16 + ⋯ = 1.

- `out/zenon_pizza.mp4`: versión final con música y efectos.
- `out/zenon_pizza_sin_audio.mp4`: la misma imagen sin sonido (para poner audio propio en la red social).
- `out/poster.png`: fotograma para la miniatura.

Todo se genera por código: animación 2D vectorial (Skia vía `@napi-rs/canvas`) y banda sonora
sintetizada (sin samples ni música de terceros). No lleva texto, solo símbolos matemáticos (0, 1,
fracciones, +, =, ⋯, ∞, ×2).

## Guion visual

| Tiempo | Qué pasa | Idea matemática |
|---|---|---|
| 0–2 s | Primer plano del monigote, "!", barrido a la pizza humeante y plano general. Ojos de corazón. | — |
| 2–3 s | El suelo se convierte en una recta numérica 0 → 1 y aparece una barra vacía encima. | La distancia total vale 1. |
| 3–9.5 s | Corre y cae una barrera "½" en mitad del camino: derrapa y se para. Luego "¼" (se para mosqueado), "⅛" (se la come de frente) y "1/16" (salta y aterriza en ella). Cada fracción vuela a la ecuación de arriba y la barra se va llenando. | Cada paso es la mitad de lo que falta. |
| 10–14 s | Lupa sobre el hueco entre su dedo y la pizza: 1/32, 1/64, 1/128, 1/256 (×2, ×4, ×8, ×16)… y una ráfaga de barreras que se amontonan contra la corteza. | Siempre queda un trozo: infinitos pasos. |
| 14–16.5 s | Rabieta con nube de ∞, se sienta con su nubecita de lluvia. | La paradoja. |
| 16.5–22.5 s | La barra crece al centro: la cola "⋯" se funde en un bloque igual a 1/16, dos 1/16 forman 1/8, dos 1/8 forman ¼, dos ¼ forman ½ y dos ½ forman **1** (dorado). Aparece "= 1" y se le enciende la bombilla. | Infinitas partes suman una cantidad finita. |
| 22.5–25.7 s | Rebobinado (⏪) y carrera final a velocidad constante: las barreras caen cada vez más deprisa (½, ¼, ⅛…) y las atraviesa todas; la barra se llena justo al llegar. | Infinitos pasos, tiempo finito. |
| 25.7–32 s | Llega a la pizza… un mini-monigote con pañuelo le roba una porción ("−⅛"). Mirada a cámara. Al ladrón le cae una barrera "½" delante y después otra "¼": ahora le toca a él. El protagonista se encoge de hombros y se come su porción. | Remate. |

## Estilo

- Fondo crema con retícula de puntos tenue, tipo libreta.
- Monigote negro con cabeza redonda algo grande, ojos blancos muy expresivos (párpados, corazones, espirales) y un único pelo rizado como seña de identidad. El mini lleva un pañuelo rojo.
- Cada término de la serie tiene un color fijo, el mismo en la barrera, el arco, la ecuación, la barra y el suelo.
- Tipografía redondeada Fredoka (OFL, incluida en `assets/fonts`).

## Cómo regenerarlo

Requiere Node 18+ y `ffmpeg` en el PATH.

```bash
npm install
node render.js                          # vídeo final con audio + versión sin audio
node render.js --preview                # media resolución a 30 fps, rápido
node render.js --sheet 0:32:1           # hoja de contactos (out/sheet.png)
node render.js --stills 4.5,12,20.4     # fotogramas sueltos en PNG
node render.js --audio                  # solo la banda sonora (WAV)
```

## Estructura

- `src/scene.js`: guion, tiempos, cámara, barreras, ecuación, barra, lupa y gag final. Exporta `drawFrame(g, t)` y la lista de *cues* de sonido.
- `src/character.js`: esqueleto del monigote (poses por ángulos, ciclo de carrera) y expresiones.
- `src/props.js`: pizza, mesa, fracciones, barreras, iconos y partículas.
- `src/audio.js`: sintetizador (cuerdas Karplus-Strong, marimba, campanas FM, batería, reverb) y efectos ligados a los mismos tiempos que la imagen.
- `src/style.js`: paleta, tipografía y maquetación.
- `render.js`: renderiza los fotogramas y los envía a ffmpeg.
