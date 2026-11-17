# Señas Armónicas

Aplicación web que reconoce señas de la mano con la cámara y las convierte en acordes de una escala. La cámara ocupa toda la página y el acorde en uso se muestra arriba a la izquierda.

**Probala:** https://uliiicas.github.io/Senas-Armonicas/

Esta primera versión reconoce las señas y muestra el acorde. Todavía no tiene sonido y la única escala disponible es Do Mayor.

## Señas

Se lee solo la **mano derecha**. Cada acorde de la escala tiene su seña:

| Grado | Acorde en Do Mayor | Notas | Dedos levantados |
|-------|--------------------|-------|------------------|
| I | Do mayor (C) | Do Mi Sol | índice |
| ii | Re menor (Dm) | Re Fa La | índice y medio |
| iii | Mi menor (Em) | Mi Sol Si | índice, medio y anular |
| IV | Fa mayor (F) | Fa La Do | índice, medio, anular y meñique (pulgar plegado) |
| V | Sol mayor (G) | Sol Si Re | los cinco dedos |
| vi | La menor (Am) | La Do Mi | solo el pulgar |
| vii° | Si disminuido (B°) | Si Re Fa | pulgar e índice |

Los grados en minúscula son acordes menores y el `°` marca el disminuido. Si no hay una seña válida (puño, mano fuera de cuadro, otra combinación de dedos), la pantalla queda en "Sin acorde".

## Cómo funciona

1. **Cámara.** `getUserMedia` abre la cámara del dispositivo. La frontal se muestra espejada; en celulares aparece un botón para pasar a la trasera.
2. **Puntos de la mano.** [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) ubica 21 puntos de cada mano en cada cuadro de video. Corre dentro del navegador (WebAssembly, con GPU si está disponible): el video no se envía a ningún servidor.
3. **Dedos levantados.** Con esos puntos en 3D, `js/gestos.js` mide qué tan estirado está cada dedo y cuánto se abre el pulgar. Las medidas no dependen del tamaño ni de la orientación de la mano, y usan dos umbrales (histéresis) para que un dedo a medio camino no parpadee.
4. **Seña → grado.** La combinación de dedos se busca en la tabla `SENAS`. Una seña nueva se acepta recién cuando se sostiene unos 110 ms, así el acorde no salta mientras los dedos se mueven.
5. **Grado → acorde.** `js/escalas.js` arma la escala y la tríada de cada grado, con sus notas y números MIDI (ya listos para cuando haya sonido).

## Estructura

```
index.html            página única
css/estilos.css       diseño
js/app.js             cámara, bucle de reconocimiento y pantalla
js/detector.js        carga de MediaPipe (único módulo que lo conoce)
js/gestos.js          dedos levantados, tabla de señas y filtro temporal
js/escalas.js         escalas y acordes
js/dibujo.js          trazo de la mano sobre el video
fuentes/              tipografías (Bodoni Moda e Instrument Sans, licencia OFL)
tests/                pruebas de la lógica
```

No hay paso de compilación: son módulos de JavaScript que el navegador carga directamente.

## Correrla en tu computadora

La cámara solo funciona en `https` o en `localhost`, así que hace falta un servidor local (abrir `index.html` con doble clic no alcanza):

```bash
npm start            # sirve la carpeta en http://localhost:8080
# o, sin Node:
python -m http.server 8080
```

Hace falta conexión a internet la primera vez, para descargar MediaPipe y el modelo.

### Opciones por dirección

- `?mano=izquierda` lee la mano izquierda en lugar de la derecha.
- `?debug` muestra en pantalla la medida de cada dedo, útil para ajustar los umbrales de `js/gestos.js`.

## Pruebas

```bash
npm test
```

Las pruebas usan un modelo geométrico de mano (`tests/mano-sintetica.mjs`) para verificar la tabla de señas, la histéresis, el filtro temporal y la construcción de acordes. No reemplazan la prueba con una mano real frente a la cámara.

## Ramas

- `main`: versión estable, la que publica GitHub Pages.
- `desarrollo`: donde se integran los cambios antes de pasar a `main`.

## Próximos pasos

- Sonido de los acordes.
- Elegir la escala desde la aplicación.
