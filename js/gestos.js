// Reconocimiento de señas a partir de los 21 puntos de la mano que entrega
// MediaPipe. Todo acá son funciones puras sobre coordenadas, sin navegador,
// para poder probarlas con `node --test`.
//
// Índices de los puntos (convención de MediaPipe):
//   0 muñeca
//   1-4   pulgar   (CMC, MCP, IP, punta)
//   5-8   índice   (MCP, PIP, DIP, punta)
//   9-12  medio
//   13-16 anular
//   17-20 meñique

export const DEDOS = ['pulgar', 'indice', 'medio', 'anular', 'menique'];

/** Articulaciones de cada dedo, de la base a la punta. */
export const PUNTOS = {
  pulgar: [1, 2, 3, 4],
  indice: [5, 6, 7, 8],
  medio: [9, 10, 11, 12],
  anular: [13, 14, 15, 16],
  menique: [17, 18, 19, 20],
};

/**
 * Seña de cada grado de la escala: qué dedos van levantados,
 * en orden [pulgar, índice, medio, anular, meñique].
 */
export const SENAS = {
  1: [false, true, false, false, false],
  2: [false, true, true, false, false],
  3: [false, true, true, true, false],
  4: [false, true, true, true, true],
  5: [true, true, true, true, true],
  6: [true, false, false, false, false],
  7: [true, true, false, false, false],
};

/**
 * Umbrales con histéresis: un dedo pasa a "levantado" recién al superar
 * `levantado` y vuelve a "plegado" recién al bajar de `plegado`. La franja
 * del medio conserva el estado anterior y evita el parpadeo.
 */
export const UMBRALES = {
  // Rectitud del dedo: 1 = totalmente estirado, ~0.3 = puño cerrado.
  dedo: { levantado: 0.88, plegado: 0.76 },
  // Cuánto se separa la punta del pulgar hacia afuera de la palma,
  // en anchos de palma: ~1 = pulgar abierto, <0.3 = pegado o cruzado.
  pulgar: { levantado: 0.58, plegado: 0.4 },
  // Inclinación lateral de la mano, en grados desde la vertical. El acorde
  // pasa a suspendido al superar `entrar` y vuelve al bajar de `salir`.
  // Más allá de `tope` la mano está casi cabeza abajo y no se interpreta.
  inclinacion: { entrar: 25, salir: 17, tope: 135 },
};

const resta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const punto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const largo = (a) => Math.hypot(a.x, a.y, a.z);
const distancia = (a, b) => largo(resta(a, b));

/**
 * Rectitud de un dedo: distancia en línea recta de la base a la punta,
 * dividida por el largo del dedo siguiendo sus falanges. No depende de la
 * orientación de la mano ni de su tamaño.
 */
function rectitud(p, [base, media, distal, punta]) {
  const recorrido =
    distancia(p[base], p[media]) + distancia(p[media], p[distal]) + distancia(p[distal], p[punta]);
  if (recorrido === 0) return 0;
  return distancia(p[base], p[punta]) / recorrido;
}

/**
 * Apertura del pulgar: proyección de la punta del pulgar sobre el eje que
 * cruza la palma del meñique al índice, medida desde el nudillo del índice
 * y en anchos de palma. Positiva y grande cuando el pulgar apunta hacia
 * afuera; chica o negativa cuando está pegado a la mano o cruzado sobre ella.
 */
function aperturaDelPulgar(p) {
  const eje = resta(p[5], p[17]);
  const ancho = largo(eje);
  if (ancho === 0) return 0;
  return punto(resta(p[4], p[5]), eje) / (ancho * ancho);
}

/**
 * Mide cada dedo. Conviene pasar los puntos "world" de MediaPipe (3D, en
 * metros), que no se deforman con la perspectiva.
 * @param {Array<{x:number,y:number,z:number}>} puntos 21 puntos de la mano.
 */
export function medirDedos(puntos) {
  return {
    pulgar: aperturaDelPulgar(puntos),
    indice: rectitud(puntos, PUNTOS.indice),
    medio: rectitud(puntos, PUNTOS.medio),
    anular: rectitud(puntos, PUNTOS.anular),
    menique: rectitud(puntos, PUNTOS.menique),
  };
}

/**
 * Convierte las medidas en dedos levantados/plegados aplicando histéresis.
 * @param {object|null} anterior Estado del cuadro anterior, o null si no había mano.
 * @param {object} medidas Resultado de `medirDedos`.
 * @returns {{pulgar:boolean, indice:boolean, medio:boolean, anular:boolean, menique:boolean}}
 */
export function actualizarDedos(anterior, medidas, umbrales = UMBRALES) {
  const estado = {};
  for (const dedo of DEDOS) {
    const u = dedo === 'pulgar' ? umbrales.pulgar : umbrales.dedo;
    const valor = medidas[dedo];
    if (valor >= u.levantado) estado[dedo] = true;
    else if (valor <= u.plegado) estado[dedo] = false;
    else if (anterior) estado[dedo] = anterior[dedo];
    else estado[dedo] = valor >= (u.levantado + u.plegado) / 2;
  }
  return estado;
}

/** Devuelve el grado (1 a 7) que corresponde a los dedos levantados, o null. */
export function gradoDeLaSena(dedos) {
  for (const [grado, patron] of Object.entries(SENAS)) {
    if (DEDOS.every((dedo, i) => dedos[dedo] === patron[i])) return Number(grado);
  }
  return null;
}

/**
 * Inclinación lateral de la mano tal como la ve la cámara: el giro, en el
 * plano de la imagen, de la línea que va de la muñeca al nudillo del dedo
 * medio (el eje de la mano, que sigue al antebrazo sin importar qué dedos
 * estén levantados). 0° = hacia arriba; positivo = hacia la derecha de la imagen.
 *
 * Si la mano apunta hacia la cámara, ese eje casi no se ve en la imagen y su
 * giro no dice nada. En ese caso, con la seña de solo pulgar (el "pulgar
 * arriba" hecho hacia la cámara) se mide la dirección del pulgar; con las
 * demás señas no se interpreta inclinación. La referencia elegida se conserva
 * mientras dure la seña (`referencia`), para que no salte a mitad de un giro.
 *
 * @param {Array<{x:number,y:number}>} imagen Puntos normalizados de MediaPipe (0 a 1).
 * @param {Array<{x:number,y:number,z:number}>} mundo Puntos 3D de la misma mano.
 * @param {number} aspecto Ancho / alto del cuadro de video.
 * @param {object} [opciones]
 * @param {boolean} [opciones.soloPulgar] Si la seña actual es la de solo pulgar.
 * @param {'eje'|'pulgar'|null} [opciones.referencia] Referencia ya elegida para esta seña.
 * @returns {{grados:number, referencia:'eje'|'pulgar'|null}} referencia null = sin inclinación legible.
 */
export function medirInclinacion(imagen, mundo, aspecto, { soloPulgar = false, referencia = null } = {}) {
  const angulo = (desde, hasta) => {
    const dx = (imagen[hasta].x - imagen[desde].x) * aspecto;
    const dy = imagen[hasta].y - imagen[desde].y; // en la imagen, y crece hacia abajo
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  };

  let elegida = referencia;
  if (!elegida) {
    const eje = resta(mundo[9], mundo[0]);
    const deFrente = Math.hypot(eje.x, eje.y) < 0.55 * largo(eje);
    elegida = deFrente ? 'pulgar' : 'eje';
  }
  if (elegida === 'pulgar' && !soloPulgar) return { grados: 0, referencia: null };
  return { grados: elegida === 'pulgar' ? angulo(2, 4) : angulo(0, 9), referencia: elegida };
}

/**
 * Decide si el acorde va suspendido según la inclinación, con histéresis.
 * @param {'sus2'|'sus4'|null} anterior Estado del cuadro anterior.
 * @param {number} haciaAfuera Grados de inclinación; positivo = hacia afuera del cuerpo.
 * @returns {'sus2'|'sus4'|null} sus4 hacia afuera, sus2 hacia adentro, null con la mano derecha.
 */
export function actualizarVariante(anterior, haciaAfuera, umbrales = UMBRALES.inclinacion) {
  const magnitud = Math.abs(haciaAfuera);
  if (magnitud > umbrales.tope) return null;
  const lado = haciaAfuera > 0 ? 'sus4' : 'sus2';
  if (magnitud >= umbrales.entrar) return lado;
  if (magnitud >= umbrales.salir && anterior === lado) return lado;
  return null;
}

/** Indica si los dedos forman la seña de solo pulgar. */
export function esSoloPulgar(dedos) {
  return dedos.pulgar && !dedos.indice && !dedos.medio && !dedos.anular && !dedos.menique;
}

/**
 * Elige, entre las manos detectadas, la que hay que leer.
 * MediaPipe etiqueta cada mano como 'Left' o 'Right' según la mano real de la
 * persona, siempre que el cuadro de video se le pase sin espejar (así lo
 * hace esta app: el espejo es solo visual, por CSS).
 * @param {object} resultado Resultado de HandLandmarker.detectForVideo.
 * @param {'Right'|'Left'} etiqueta Mano que se quiere leer.
 * @returns {{indice:number, hayOtraMano:boolean}} indice = -1 si esa mano no está.
 */
export function elegirMano(resultado, etiqueta) {
  const manos = resultado?.handedness ?? [];
  let indice = -1;
  let mejor = -Infinity;
  manos.forEach((categorias, i) => {
    const c = categorias?.[0];
    if (c && c.categoryName === etiqueta && c.score > mejor) {
      mejor = c.score;
      indice = i;
    }
  });
  return { indice, hayOtraMano: indice === -1 && manos.length > 0 };
}

/**
 * Filtro temporal: una seña nueva recién se acepta si se mantiene un rato.
 * Evita que el acorde salte mientras los dedos están en movimiento.
 */
export class Estabilizador {
  /**
   * @param {object} [esperas]
   * @param {number} [esperas.acorde] ms que debe sostenerse una seña nueva.
   * @param {number} [esperas.silencio] ms sin seña válida antes de quedar sin acorde.
   */
  constructor({ acorde = 110, silencio = 220 } = {}) {
    this.esperas = { acorde, silencio };
    this.actual = null;
    this.candidato = null;
    this.desde = 0;
  }

  /** Vuelve al estado inicial, sin acorde. */
  reiniciar() {
    this.actual = null;
    this.candidato = null;
    this.desde = 0;
  }

  /**
   * @param {number|null} valor Grado leído en este cuadro.
   * @param {number} ahora Tiempo en ms (performance.now()).
   * @returns {number|null} Grado estable.
   */
  actualizar(valor, ahora) {
    if (valor === this.actual) {
      this.candidato = valor;
      this.desde = ahora;
      return this.actual;
    }
    if (valor !== this.candidato) {
      this.candidato = valor;
      this.desde = ahora;
      return this.actual;
    }
    const espera = valor === null ? this.esperas.silencio : this.esperas.acorde;
    if (ahora - this.desde >= espera) this.actual = valor;
    return this.actual;
  }
}
