// Único módulo que conoce a MediaPipe. Carga el modelo Hand Landmarker,
// que ubica 21 puntos de cada mano en tiempo real dentro del navegador
// (el video nunca sale del dispositivo).

const VERSION = '1.2.3';
const BIBLIOTECA = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODELO =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Crea el detector de manos en modo video.
 * Intenta usar la placa de video y, si no puede, sigue con el procesador.
 * @returns {Promise<{detectForVideo: Function, close: Function}>}
 */
export async function crearDetector() {
  const { FilesetResolver, HandLandmarker } = await import(`${BIBLIOTECA}/vision_bundle.mjs`);
  const archivos = await FilesetResolver.forVisionTasks(`${BIBLIOTECA}/wasm`);

  const opciones = (delegate) => ({
    baseOptions: { modelAssetPath: MODELO, delegate },
    runningMode: 'VIDEO',
    // Se buscan dos manos para poder distinguir la derecha de la izquierda
    // cuando aparecen las dos; solo se lee una.
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  try {
    return await HandLandmarker.createFromOptions(archivos, opciones('GPU'));
  } catch (error) {
    console.warn('No se pudo usar la GPU; se sigue con la CPU.', error);
    return HandLandmarker.createFromOptions(archivos, opciones('CPU'));
  }
}
