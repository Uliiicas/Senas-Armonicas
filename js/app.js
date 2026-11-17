// Señas Armónicas: une la cámara, el detector de manos y la pantalla.

import { ESCALAS, ESCALA_INICIAL } from './escalas.js';
import {
  SENAS,
  DEDOS,
  medirDedos,
  actualizarDedos,
  gradoDeLaSena,
  elegirMano,
  Estabilizador,
} from './gestos.js';
import { crearDetector } from './detector.js';
import { ajustarLienzo, limpiar, dibujarMano } from './dibujo.js';

// ---------- Configuración ----------

const parametros = new URLSearchParams(location.search);

// La app lee la mano derecha. Con ?mano=izquierda lee la otra.
const MANO =
  parametros.get('mano') === 'izquierda'
    ? { etiqueta: 'Left', nombre: 'izquierda', otra: 'derecha' }
    : { etiqueta: 'Right', nombre: 'derecha', otra: 'izquierda' };

// Con ?debug se muestran las medidas de cada dedo, para ajustar umbrales.
const DEPURAR = parametros.has('debug');

// Un color por nota fundamental, como en los instrumentos de colores.
const COLOR_DE_NOTA = {
  Do: '#ff5f52',
  Re: '#ff9b42',
  Mi: '#ffd84d',
  Fa: '#74dd6f',
  Sol: '#45d3cc',
  La: '#958fff',
  Si: '#f47fd2',
};

const NOMBRE_DE_DEDO = {
  pulgar: 'pulgar',
  indice: 'índice',
  medio: 'medio',
  anular: 'anular',
  menique: 'meñique',
};

// ---------- Elementos ----------

const $ = (id) => document.getElementById(id);
const escenario = $('escenario');
const video = $('camara');
const lienzo = $('trazo');
const panel = $('acorde');
const elEscala = $('escala');
const elGrado = $('grado');
const elNombre = $('nombre');
const elCifrado = $('cifrado');
const elDetalle = $('detalle');
const elGuia = $('guia');
const aviso = $('aviso');
const avisoTexto = $('aviso-texto');
const botonReintentar = $('reintentar');
const botonCamara = $('cambiar-camara');
const elMedidas = $('medidas');

// ---------- Estado ----------

const escala = ESCALAS[ESCALA_INICIAL];
const estabilizador = new Estabilizador();

let detector = null;
let orientacion = 'user'; // 'user' = cámara frontal, 'environment' = trasera
let dedos = null; // dedos levantados de la mano que se está leyendo
let gradoActual; // undefined hasta el primer dibujo; después 1 a 7 o null
let pistaActual = '';
let ultimoTiempoDeVideo = -1;
let fallosSeguidos = 0;
let enMarcha = false;

const colorDe = (acorde) => COLOR_DE_NOTA[acorde.notas[0].replace(/[♯♭]/g, '')] ?? '#f7f0e3';

// ---------- Pantalla ----------

function armarGuia() {
  elEscala.textContent = escala.nombre;
  elGuia.replaceChildren(
    ...escala.acordes.map((acorde) => {
      const patron = SENAS[acorde.grado];
      const item = document.createElement('li');
      item.className = 'guia__sena';
      item.dataset.grado = acorde.grado;
      item.style.setProperty('--color', colorDe(acorde));
      const levantados = DEDOS.filter((_, i) => patron[i]).map((d) => NOMBRE_DE_DEDO[d]);
      item.setAttribute('aria-label', `${acorde.romano}, ${acorde.nombre}: ${levantados.join(', ')}`);

      const mano = document.createElement('span');
      mano.className = 'guia__mano';
      mano.setAttribute('aria-hidden', 'true');
      patron.forEach((arriba) => {
        const dedo = document.createElement('span');
        dedo.className = 'guia__dedo';
        dedo.dataset.arriba = arriba ? 'si' : 'no';
        mano.append(dedo);
      });

      const grado = document.createElement('span');
      grado.className = 'guia__grado';
      grado.setAttribute('aria-hidden', 'true');
      grado.textContent = acorde.romano;

      item.append(mano, grado);
      return item;
    }),
  );
}

function mostrarAcorde(grado) {
  gradoActual = grado;
  const acorde = grado === null ? null : escala.acordes[grado - 1];

  panel.dataset.vacio = acorde ? 'no' : 'si';
  escenario.style.setProperty('--acento', acorde ? colorDe(acorde) : 'var(--marfil)');

  if (acorde) {
    elGrado.textContent = acorde.romano;
    elNombre.textContent = acorde.nombre;
    elCifrado.textContent = acorde.cifrado;
    elDetalle.replaceChildren(
      ...acorde.notas.map((nota) => {
        const span = document.createElement('span');
        span.textContent = nota;
        return span;
      }),
    );
    pistaActual = '';
    // Reinicia la animación de entrada del número.
    elGrado.classList.remove('entra');
    void elGrado.offsetWidth;
    elGrado.classList.add('entra');
  } else {
    elGrado.textContent = '';
    elNombre.textContent = 'Sin acorde';
    elCifrado.textContent = '';
    elDetalle.textContent = pistaActual;
  }

  for (const item of elGuia.children) {
    item.setAttribute('aria-current', String(Number(item.dataset.grado) === grado));
  }
}

function mostrarPista(texto) {
  if (texto === pistaActual) return;
  pistaActual = texto;
  if (gradoActual === null) elDetalle.textContent = texto;
}

function mostrarAviso(texto, { reintentar = false } = {}) {
  avisoTexto.textContent = texto;
  botonReintentar.hidden = !reintentar;
  aviso.dataset.oculto = 'no';
}

function ocultarAviso() {
  aviso.dataset.oculto = 'si';
}

// ---------- Cámara ----------

function mensajeDeCamara(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'No hay permiso para usar la cámara. Habilitalo para este sitio desde la barra de direcciones y volvé a intentar.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró ninguna cámara en este dispositivo.';
    case 'NotReadableError':
    case 'AbortError':
      return 'La cámara está ocupada por otra aplicación. Cerrala y volvé a intentar.';
    default:
      return 'No se pudo abrir la cámara. Volvé a intentar.';
  }
}

function cerrarCamara() {
  video.srcObject?.getTracks().forEach((pista) => pista.stop());
  video.srcObject = null;
}

async function abrirCamara() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error('Sin acceso a getUserMedia');
    error.mensaje = window.isSecureContext
      ? 'Este navegador no permite usar la cámara desde una página web.'
      : 'La cámara solo funciona en páginas https o en localhost. Abrí la app desde una dirección segura.';
    throw error;
  }

  cerrarCamara();
  let flujo;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: orientacion, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (error) {
    error.mensaje = mensajeDeCamara(error);
    throw error;
  }

  video.srcObject = flujo;
  await video.play();

  // Solo la cámara trasera se muestra sin espejar.
  const real = flujo.getVideoTracks()[0]?.getSettings().facingMode;
  escenario.dataset.espejo = real === 'environment' ? 'no' : 'si';
  ultimoTiempoDeVideo = -1;

  const dispositivos = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  botonCamara.hidden = dispositivos.filter((d) => d.kind === 'videoinput').length < 2;
}

async function cambiarCamara() {
  botonCamara.disabled = true;
  const anterior = orientacion;
  orientacion = orientacion === 'user' ? 'environment' : 'user';
  try {
    await abrirCamara();
  } catch (error) {
    console.error(error);
    orientacion = anterior;
    await abrirCamara().catch((e) => mostrarAviso(e.mensaje ?? mensajeDeCamara(e), { reintentar: true }));
  } finally {
    botonCamara.disabled = false;
  }
}

// ---------- Reconocimiento cuadro a cuadro ----------

function procesar(resultado, ahora) {
  const { indice, hayOtraMano } = elegirMano(resultado, MANO.etiqueta);
  let grado = null;
  let medidas = null;

  if (indice >= 0) {
    // Los puntos "world" están en metros y no se deforman con la perspectiva.
    medidas = medirDedos(resultado.worldLandmarks[indice]);
    dedos = actualizarDedos(dedos, medidas);
    grado = gradoDeLaSena(dedos);
  } else {
    dedos = null;
  }

  const estable = estabilizador.actualizar(grado, ahora);
  if (estable !== gradoActual) mostrarAcorde(estable);

  if (indice >= 0) {
    // Mientras una seña válida se está por confirmar, no se cambia el texto.
    if (grado === null) mostrarPista('Esa seña no tiene un acorde asignado.');
  } else if (hayOtraMano) mostrarPista(`Esa es la mano ${MANO.otra}. Usá la ${MANO.nombre}.`);
  else mostrarPista(`Mostrá tu mano ${MANO.nombre} a la cámara.`);

  // Trazo de las manos sobre el video.
  ajustarLienzo(lienzo);
  limpiar(lienzo);
  const acorde = estable === null ? null : escala.acordes[estable - 1];
  (resultado.landmarks ?? []).forEach((puntos, i) => {
    if (i === indice) dibujarMano(lienzo, video, puntos, { dedos, color: acorde ? colorDe(acorde) : '#f7f0e3' });
    else dibujarMano(lienzo, video, puntos);
  });

  if (DEPURAR) {
    elMedidas.hidden = false;
    elMedidas.textContent = medidas
      ? DEDOS.map((d) => `${d.padEnd(8)}${medidas[d].toFixed(2).padStart(6)}  ${dedos[d] ? '▲' : '·'}`).join('\n')
      : 'sin mano';
  }
}

function cuadro() {
  if (!enMarcha) return;
  requestAnimationFrame(cuadro);
  if (!detector || video.readyState < 2 || !video.videoWidth) return;
  if (video.currentTime === ultimoTiempoDeVideo) return;
  ultimoTiempoDeVideo = video.currentTime;

  const ahora = performance.now();
  let resultado;
  try {
    resultado = detector.detectForVideo(video, ahora);
    fallosSeguidos = 0;
  } catch (error) {
    console.error(error);
    if (++fallosSeguidos > 30) {
      enMarcha = false;
      mostrarAviso('El reconocimiento de manos dejó de responder. Volvé a intentar.', { reintentar: true });
    }
    return;
  }
  procesar(resultado, ahora);
}

// ---------- Arranque ----------

async function iniciar() {
  enMarcha = false;
  mostrarAviso('Preparando el reconocimiento de manos. Si el navegador lo pide, permití el uso de la cámara.');

  // El modelo y la cámara se preparan a la vez.
  const cargaDelDetector = detector
    ? Promise.resolve(detector)
    : crearDetector().catch((error) => {
        error.mensaje =
          'No se pudo cargar el reconocimiento de manos. Revisá la conexión a internet y volvé a intentar.';
        throw error;
      });

  const [camara, modelo] = await Promise.allSettled([abrirCamara(), cargaDelDetector]);
  if (modelo.status === 'fulfilled') detector = modelo.value;
  const fallo = [camara, modelo].find((r) => r.status === 'rejected');
  if (fallo) {
    console.error(fallo.reason);
    mostrarAviso(fallo.reason?.mensaje ?? 'Algo salió mal al iniciar. Volvé a intentar.', { reintentar: true });
    return;
  }

  ocultarAviso();
  enMarcha = true;
  requestAnimationFrame(cuadro);
}

armarGuia();
mostrarAcorde(null);
mostrarPista(`Mostrá tu mano ${MANO.nombre} a la cámara.`);

botonReintentar.addEventListener('click', iniciar);
botonCamara.addEventListener('click', cambiarCamara);
window.addEventListener('resize', () => ajustarLienzo(lienzo));

iniciar();
