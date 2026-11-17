# Señas Armónicas

Aplicación web que reconoce señas de la mano con la cámara y las convierte en acordes de una escala, que suenan mientras se sostiene la seña. La mano derecha elige el acorde; la izquierda abierta le agrega la séptima. La cámara ocupa toda la página y el acorde en uso se muestra arriba a la izquierda.

**Probala:** https://uliiicas.github.io/Senas-Armonicas/

Por ahora la única escala disponible es Do Mayor.

## Señas

La **mano derecha** elige el acorde. Cada acorde de la escala tiene su seña:

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

## Inclinación: sus2 y sus4

Ladear la mano hacia los costados, sin cambiar la seña, convierte el acorde en suspendido:

| Inclinación de la mano | Acorde | Ejemplo en el grado I |
|------------------------|--------|-----------------------|
| Hacia **afuera** del cuerpo (a la derecha, con la mano derecha) | sus4 | Do sus4: Do Fa Sol |
| Derecha, sin inclinar | el acorde normal | Do mayor: Do Mi Sol |
| Hacia **adentro** del cuerpo | sus2 | Do sus2: Do Re Sol |

El acorde pasa a suspendido cuando la mano se inclina unos 25° y vuelve al normal al enderezarla por debajo de unos 17°. El indicador que está debajo de las notas muestra en todo momento cuánto está inclinada la mano y hacia qué lado queda cada variante.

En un acorde suspendido la tercera se reemplaza por la cuarta justa (sus4) o por la segunda mayor (sus2) sobre la fundamental, que es el significado habitual del cifrado. Por eso algunos usan una nota que no está en Do Mayor: Fa sus4 lleva Si♭, Mi sus2 lleva Fa♯ y Si sus2 lleva Do♯. El grado VII conserva su quinta disminuida y se escribe "sus4 (♭5)".

## Mano izquierda abierta: séptima

Con la **mano izquierda abierta** a la vista (índice, medio, anular y meñique estirados; el pulgar puede estar como quiera), el acorde que hace la derecha suena con su séptima: la nota de la escala que está una séptima arriba de la fundamental. Al cerrar la mano izquierda, o al sacarla de cuadro, el acorde vuelve a ser una tríada.

| Grado | Con la izquierda abierta | Notas |
|-------|--------------------------|-------|
| I⁷ | Do séptima mayor (Cmaj7) | Do Mi Sol Si |
| ii⁷ | Re menor séptima (Dm7) | Re Fa La Do |
| iii⁷ | Mi menor séptima (Em7) | Mi Sol Si Re |
| IV⁷ | Fa séptima mayor (Fmaj7) | Fa La Do Mi |
| V⁷ | Sol séptima (G7) | Sol Si Re Fa |
| vi⁷ | La menor séptima (Am7) | La Do Mi Sol |
| viiø⁷ | Si semidisminuido (Bm7♭5) | Si Re Fa La |

Se combina con la inclinación: la séptima también se agrega a los acordes suspendidos, por ejemplo Sol séptima sus4 (G7sus4: Sol Do Re Fa) o Do séptima mayor sus2 (Cmaj7sus2: Do Re Sol Si).

Debajo del indicador de inclinación, la marca **7ª** se enciende mientras la mano izquierda está abierta, y esa mano se dibuja con el color del acorde. El cambio pasa por el mismo filtro temporal que las señas, así que abrir o cerrar la mano a medias no hace parpadear el acorde.

Al sonar con séptima, la fundamental queda en el bajo (piano) o en el trombón grave (vientos), y arriba suenan tercera, quinta y séptima. Así la séptima mayor no queda pegada a medio tono de la fundamental.

## Sonido

Arriba a la derecha están el selector de instrumento y la barra de volumen. La elección queda guardada en el navegador.

| Instrumento | Cómo suena |
|-------------|------------|
| **Piano eléctrico** | Al estilo del Yamaha CP70: ataque de martillo, timbre brillante con coro estéreo y mucho sustain. El acorde se golpea una vez y queda sonando varios segundos mientras se sostiene la seña. |
| **Vientos de salsa** | Sección de tres trompetas y dos trombones, con ataque acentuado y vibrato. El acorde suena todo el tiempo que dure la seña y se corta al soltarla. |

Los dos instrumentos están sintetizados en el navegador con Web Audio: no se descargan grabaciones. Son una aproximación al timbre de los instrumentos reales, no muestras de ellos.

Algunos navegadores (sobre todo en celulares) no dejan sonar nada hasta que se toca la pantalla. En ese caso aparece el botón **Activar sonido**.

## Cómo funciona

1. **Cámara.** `getUserMedia` abre la cámara del dispositivo. La frontal se muestra espejada; en celulares aparece un botón para pasar a la trasera.
2. **Puntos de la mano.** [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) ubica 21 puntos de cada mano en cada cuadro de video. Corre dentro del navegador (WebAssembly, con GPU si está disponible): el video no se envía a ningún servidor.
3. **Dedos levantados.** Con esos puntos en 3D, `js/gestos.js` mide qué tan estirado está cada dedo y cuánto se abre el pulgar. Las medidas no dependen del tamaño ni de la orientación de la mano, y usan dos umbrales (histéresis) para que un dedo a medio camino no parpadee.
4. **Seña → grado.** La combinación de dedos de la mano derecha se busca en la tabla `SENAS`. Una seña nueva se acepta recién cuando se sostiene unos 110 ms, así el acorde no salta mientras los dedos se mueven.
5. **Inclinación → variante.** Se mide en la imagen el giro de la línea que va de la muñeca al nudillo del dedo medio. Esa línea sigue al antebrazo, así que no depende de qué dedos estén levantados.
6. **Mano izquierda → séptima.** La otra mano se mide igual que la derecha; si tiene los cuatro dedos estirados (`esManoAbierta`), el acorde lleva séptima.
7. **Grado → acorde.** `js/escalas.js` arma la escala y la tríada de cada grado, con sus variantes sus2 y sus4, la versión con séptima de cada una, sus notas y números MIDI.
8. **Acorde → sonido.** `js/voces.js` reparte las notas entre las voces del instrumento (bajo y tríada en el piano; trombones y trompetas en los vientos), buscando que cada voz se mueva poco al cambiar de acorde. `js/instrumentos.js` sintetiza cada voz y `js/sonido.js` las pasa por reverberación, volumen y un limitador que evita la saturación.

## Estructura

```
index.html            página única
css/estilos.css       diseño
js/app.js             cámara, bucle de reconocimiento y pantalla
js/detector.js        carga de MediaPipe (único módulo que lo conoce)
js/gestos.js          dedos levantados, tabla de señas, inclinación, mano abierta y filtro temporal
js/escalas.js         escalas y acordes (tríadas, sus y con séptima)
js/voces.js           qué nota toca cada voz de cada instrumento
js/instrumentos.js    síntesis del piano eléctrico y de los vientos
js/sonido.js          cadena de audio: efectos, volumen y limitador
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

- `?mano=izquierda` invierte los papeles: la izquierda elige el acorde y la derecha abierta agrega la séptima.
- `?debug` muestra en pantalla la medida de cada dedo, los grados de inclinación y los dedos de la mano izquierda, útil para ajustar los umbrales de `js/gestos.js`.

## Pruebas

```bash
npm test
```

Las pruebas usan un modelo geométrico de mano (`tests/mano-sintetica.mjs`) para verificar la tabla de señas, la histéresis, la inclinación, la mano abierta, el filtro temporal, la construcción de acordes y el reparto de voces. No reemplazan la prueba con una mano real frente a la cámara ni escuchar los instrumentos.

## Ramas

- `main`: versión estable, la que publica GitHub Pages.
- `desarrollo`: donde se integran los cambios antes de pasar a `main`.

## Próximos pasos

- Elegir la escala desde la aplicación.
