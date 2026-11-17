// Modelo geométrico simple de una mano, para probar el reconocimiento sin
// cámara. Genera los 21 puntos con la misma numeración que MediaPipe.
//
// Ejes locales de la mano (en metros): x hacia el lado del pulgar,
// y hacia la punta de los dedos, z saliendo de la palma.

const CM = 0.01;

const NUDILLOS = {
  indice: [2.5, 9.0, 0],
  medio: [0.3, 9.5, 0],
  anular: [-1.7, 9.0, 0],
  menique: [-3.5, 8.0, 0],
};

const FALANGES = {
  indice: [4.0, 2.5, 2.0],
  medio: [4.5, 2.8, 2.1],
  anular: [4.1, 2.6, 2.0],
  menique: [3.2, 1.9, 1.8],
};

const BASE_PULGAR = [2.8, 2.5, 0.5];
const FALANGES_PULGAR = [4.0, 3.2, 2.7];

// Posturas del pulgar: dirección de cada una de sus tres falanges.
const POSTURAS_PULGAR = {
  abierto: [[0.8, 0.6, 0.1], [0.8, 0.6, 0.1], [0.75, 0.65, 0.1]],
  relajado: [[0.55, 0.82, 0.15], [0.5, 0.85, 0.15], [0.45, 0.88, 0.15]],
  pegado: [[0.15, 0.98, 0.1], [0.1, 0.99, 0.1], [0.05, 0.99, 0.1]],
  cruzado: [[0.2, 0.8, 0.55], [-0.7, 0.5, 0.5], [-0.9, 0.2, 0.3]],
};

const normalizar = ([x, y, z]) => {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
};

const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * @param {object} forma
 * @param {number[]} forma.curvatura Curvatura de índice, medio, anular y meñique: 0 estirado, 1 puño.
 * @param {string|{de:string,a:string,t:number}} forma.pulgar Postura del pulgar o mezcla entre dos.
 * @returns {Array<{x:number,y:number,z:number}>} 21 puntos en ejes locales (metros).
 */
export function manoLocal({ curvatura, pulgar }) {
  const puntos = [[0, 0, 0]];

  const postura =
    typeof pulgar === 'string'
      ? POSTURAS_PULGAR[pulgar]
      : POSTURAS_PULGAR[pulgar.de].map((d, i) => mezclar(d, POSTURAS_PULGAR[pulgar.a][i], pulgar.t));
  let p = BASE_PULGAR;
  puntos.push(p);
  postura.forEach((direccion, i) => {
    const d = normalizar(direccion);
    p = p.map((v, k) => v + d[k] * FALANGES_PULGAR[i]);
    puntos.push(p);
  });

  ['indice', 'medio', 'anular', 'menique'].forEach((dedo, n) => {
    const c = curvatura[n];
    // Flexión acumulada en cada articulación, hacia la palma (+z).
    const flexiones = [c * 80, c * 100, c * 70].map((g) => (g * Math.PI) / 180);
    let q = NUDILLOS[dedo];
    puntos.push(q);
    let angulo = 0;
    FALANGES[dedo].forEach((largo, i) => {
      angulo += flexiones[i];
      q = [q[0], q[1] + Math.cos(angulo) * largo, q[2] + Math.sin(angulo) * largo];
      puntos.push(q);
    });
  });

  return puntos.map(([x, y, z]) => ({ x: x * CM, y: y * CM, z: z * CM }));
}

/** Gira los puntos con ángulos de Euler (radianes) alrededor de x, y, z. */
export function girar(puntos, [ax, ay, az]) {
  const [cx, sx, cy, sy, cz, sz] = [
    Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az),
  ];
  return puntos.map(({ x, y, z }) => {
    let [x1, y1, z1] = [x, y * cx - z * sx, y * sx + z * cx];
    [x1, y1, z1] = [x1 * cy + z1 * sy, y1, -x1 * sy + z1 * cy];
    [x1, y1, z1] = [x1 * cz - y1 * sz, x1 * sz + y1 * cz, z1];
    return { x: x1, y: y1, z: z1 };
  });
}

/** Suma ruido uniforme de ±amplitud (metros) a cada coordenada. */
export function conRuido(puntos, amplitud, azar = Math.random) {
  const r = () => (azar() * 2 - 1) * amplitud;
  return puntos.map(({ x, y, z }) => ({ x: x + r(), y: y + r(), z: z + r() }));
}

/** Generador pseudoaleatorio con semilla, para que las pruebas sean repetibles. */
export function azarConSemilla(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Forma de la mano para cada grado: dedos levantados → curvatura y pulgar. */
export function formaDeLaSena([pulgar, ...dedos], { pulgarPlegado = 'cruzado', pulgarLevantado = 'abierto' } = {}) {
  return {
    curvatura: dedos.map((levantado) => (levantado ? 0.05 : 0.95)),
    pulgar: pulgar ? pulgarLevantado : pulgarPlegado,
  };
}

/** Proyecta la mano a coordenadas de imagen normalizadas (0 a 1), como MediaPipe. */
export function aImagen(puntos, { centroX = 0.5, centroY = 0.75, escala = 2.2, aspecto = 16 / 9 } = {}) {
  return puntos.map(({ x, y, z }) => ({
    x: centroX + (x * escala) / aspecto,
    y: centroY - y * escala,
    z: -z,
  }));
}
