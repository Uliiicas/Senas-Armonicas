// Dibuja el esqueleto de la mano sobre el video.

import { DEDOS, PUNTOS } from './gestos.js';

const MARFIL = '#f7f0e3';
const MARFIL_TENUE = 'rgba(247, 240, 227, 0.38)';
const SOMBRA = 'rgba(16, 9, 26, 0.55)';

// Contorno de la palma: muñeca → base de cada dedo.
const PALMA = [[0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17]];

/** Ajusta la resolución del lienzo a su tamaño en pantalla. */
export function ajustarLienzo(lienzo) {
  const densidad = Math.min(window.devicePixelRatio || 1, 2);
  const ancho = Math.round(lienzo.clientWidth * densidad);
  const alto = Math.round(lienzo.clientHeight * densidad);
  if (lienzo.width !== ancho || lienzo.height !== alto) {
    lienzo.width = ancho;
    lienzo.height = alto;
  }
  return densidad;
}

export function limpiar(lienzo) {
  lienzo.getContext('2d').clearRect(0, 0, lienzo.width, lienzo.height);
}

/**
 * Convierte puntos normalizados del cuadro de video (0 a 1) a píxeles del
 * lienzo, replicando el recorte de `object-fit: cover` del video.
 */
function proyectar(puntos, lienzo, video) {
  const escala = Math.max(lienzo.width / video.videoWidth, lienzo.height / video.videoHeight);
  const dx = (lienzo.width - video.videoWidth * escala) / 2;
  const dy = (lienzo.height - video.videoHeight * escala) / 2;
  return puntos.map((p) => ({
    x: dx + p.x * video.videoWidth * escala,
    y: dy + p.y * video.videoHeight * escala,
  }));
}

function linea(ctx, puntos, indices) {
  ctx.beginPath();
  indices.forEach((i, n) => (n === 0 ? ctx.moveTo(puntos[i].x, puntos[i].y) : ctx.lineTo(puntos[i].x, puntos[i].y)));
  ctx.stroke();
}

/**
 * @param {HTMLCanvasElement} lienzo
 * @param {HTMLVideoElement} video
 * @param {Array<{x:number,y:number}>} puntosNormalizados Los 21 puntos de la mano.
 * @param {object} opciones
 * @param {object|null} opciones.dedos Dedos levantados; null dibuja la mano atenuada.
 * @param {string} opciones.color Color de los dedos levantados.
 */
export function dibujarMano(lienzo, video, puntosNormalizados, { dedos = null, color = MARFIL } = {}) {
  if (!video.videoWidth) return;
  const ctx = lienzo.getContext('2d');
  const densidad = lienzo.width / (lienzo.clientWidth || lienzo.width);
  const p = proyectar(puntosNormalizados, lienzo, video);

  // El grosor acompaña al tamaño de la mano en pantalla.
  const palma = Math.hypot(p[9].x - p[0].x, p[9].y - p[0].y);
  const grosor = Math.max(2.5 * densidad, Math.min(palma * 0.045, 7 * densidad));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const trazos = [
    ...PALMA.map((par) => ({ indices: par, estilo: MARFIL_TENUE })),
    ...DEDOS.map((dedo) => ({
      indices: PUNTOS[dedo],
      estilo: dedos?.[dedo] ? color : MARFIL_TENUE,
    })),
  ];

  // Primero una sombra, para que el trazo se vea sobre fondos claros.
  ctx.strokeStyle = SOMBRA;
  ctx.lineWidth = grosor * 1.9;
  trazos.forEach((t) => linea(ctx, p, t.indices));

  ctx.lineWidth = grosor;
  trazos.forEach((t) => {
    ctx.strokeStyle = t.estilo;
    linea(ctx, p, t.indices);
  });

  // Puntas: llenas si el dedo está levantado, huecas si está plegado.
  DEDOS.forEach((dedo) => {
    const punta = p[PUNTOS[dedo][3]];
    const levantado = Boolean(dedos?.[dedo]);
    ctx.beginPath();
    ctx.arc(punta.x, punta.y, grosor * (levantado ? 1.55 : 1.0), 0, Math.PI * 2);
    ctx.fillStyle = levantado ? color : SOMBRA;
    ctx.fill();
    ctx.lineWidth = grosor * 0.45;
    ctx.strokeStyle = levantado ? MARFIL : MARFIL_TENUE;
    ctx.stroke();
  });
}
