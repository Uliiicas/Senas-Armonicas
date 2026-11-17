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
  UMBRALES,
  medirInclinacion,
  actualizarVariante,
  esSoloPulgar,
  esManoAbierta,
} from './gestos.js';
import { crearDetector } from './detector.js';
import { ajustarLienzo, limpiar, dibujarMano } from './dibujo.js';
import { INSTRUMENTOS, INSTRUMENTO_INICIAL } from './instrumentos.js';
import { Sonido, VOLUMEN_INICIAL } from './sonido.js';

// ---------- Configuración ----------

const parametros = new URLSearchParams(location.search);

// Los acordes se eligen con la mano derecha y la izquierda abierta agrega la
// séptima. Con ?mano=izquierda se invierten los papeles.
const MANO =
  parametros.get('mano') === 'izquierda'
    ? { etiqueta: 'Left', nombre: 'izquierda', otra: 'derecha', etiquetaOtra: 'Right' }
    : { etiqueta: 'Right', nombre: 'derecha', otra: 'izquierda', etiquetaOtra: 'Left' };

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
const elInclinacion = $('inclinacion');
const ladoIzquierdo = $('lado-izquierdo');
const ladoDerecho = $('lado-derecho');
const elSeptima = $('septima');
const elSeptimaTexto = $('septima-texto');
const elInstrumentos = $('instrumentos');
const barraVolumen = $('volumen');
const botonSonido = $('activar-sonido');

// ---------- Estado ----------

const escala = ESCALAS[ESCALA_INICIAL];
const estabilizador = new Estabilizador();

let detector = null;
let orientacion = 'user'; // 'user' = cámara frontal, 'environment' = trasera
let dedos = null; // dedos levantados de la mano que elige el acorde
let dedosDeLaOtra = null; // dedos levantados de la otra mano (la de la séptima)
// Acorde en pantalla: undefined hasta el primer dibujo; después null o una
// clave como '4' (grado IV), '4:sus2' (grado IV suspendido), '4:7' (IV con
// séptima) o '4:sus2:7' (las dos cosas).
let claveActual;
let variante = null; // 'sus2', 'sus4' o null según la inclinación de la mano
let septima = false; // si la otra mano está abierta
let referenciaDelPulgar = null; // referencia de inclinación mientras dura la seña de solo pulgar
let inclinacionSuave = 0; // inclinación en pantalla, suavizada para el indicador
let pistaActual = '';
let ultimoTiempoDeVideo = -1;
let fallosSeguidos = 0;
let enMarcha = false;

// ---------- Preferencias guardadas en el navegador ----------

const CLAVE = 'senas-armonicas';

function leerPreferencia(nombre) {
  try {
    return localStorage.getItem(`${CLAVE}:${nombre}`);
  } catch {
    return null;
  }
}

function guardarPreferencia(nombre, valor) {
  try {
    localStorage.setItem(`${CLAVE}:${nombre}`, valor);
  } catch {
    // Sin almacenamiento disponible: la elección vale solo para esta visita.
  }
}

// ---------- Sonido ----------

const instrumentoGuardado = leerPreferencia('instrumento');
const volumenGuardado = Number.parseFloat(leerPreferencia('volumen') ?? '');

const sonido = new Sonido({
  instrumento: INSTRUMENTOS[instrumentoGuardado] ? instrumentoGuardado : INSTRUMENTO_INICIAL,
  volumen: volumenGuardado >= 0 && volumenGuardado <= 1 ? volumenGuardado : VOLUMEN_INICIAL,
  alCambiarEstado: actualizarBotonDeSonido,
});

// El botón aparece solo si el navegador exige un toque para habilitar el audio.
function actualizarBotonDeSonido() {
  botonSonido.hidden = !enMarcha || sonido.activo;
}

function armarControles() {
  for (const [clave, instrumento] of Object.entries(INSTRUMENTOS)) {
    const opcion = document.createElement('label');
    opcion.className = 'instrumentos__opcion';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'instrumento';
    radio.value = clave;
    radio.checked = clave === sonido.instrumento;
    radio.setAttribute('aria-label', instrumento.nombre);
    radio.addEventListener('change', () => {
      sonido.fijarInstrumento(clave);
      guardarPreferencia('instrumento', clave);
    });

    const nombre = document.createElement('span');
    nombre.className = 'instrumentos__nombre';
    nombre.setAttribute('aria-hidden', 'true');
    const largo = document.createElement('span');
    largo.className = 'instrumentos__largo';
    largo.textContent = instrumento.nombre;
    const corto = document.createElement('span');
    corto.className = 'instrumentos__corto';
    corto.textContent = instrumento.corto;
    nombre.append(largo, corto);

    opcion.append(radio, nombre);
    elInstrumentos.append(opcion);
  }

  const pintarVolumen = () => barraVolumen.style.setProperty('--lleno', `${barraVolumen.value}%`);
  barraVolumen.value = Math.round(sonido.volumen * 100);
  pintarVolumen();
  barraVolumen.addEventListener('input', () => {
    const volumen = barraVolumen.valueAsNumber / 100;
    sonido.fijarVolumen(volumen);
    guardarPreferencia('volumen', String(volumen));
    pintarVolumen();
  });

  // Cualquier toque, clic o tecla sirve para habilitar el audio.
  botonSonido.addEventListener('click', () => sonido.activar());
  for (const evento of ['pointerdown', 'keydown']) {
    document.addEventListener(evento, () => sonido.activar(), { passive: true });
  }
}

// Grados de inclinación que abarca el indicador hacia cada lado.
const RANGO_DEL_INDICADOR = 60;

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

/** Clave del acorde: grado, variante suspendida y séptima. */
function claveDe(grado, variante, septima) {
  if (grado === null) return null;
  return [grado, variante, septima ? '7' : null].filter(Boolean).join(':');
}

/** Acorde que corresponde a una clave ('4', '4:sus2', '4:7', '4:sus2:7') o null. */
function acordeDe(clave) {
  if (clave === null || clave === undefined) return null;
  const [grado, ...extras] = clave.split(':');
  let acorde = escala.acordes[Number(grado) - 1];
  const tipo = extras.find((e) => e.startsWith('sus'));
  if (tipo) acorde = acorde.variantes[tipo];
  if (extras.includes('7')) acorde = acorde.conSeptima;
  return acorde;
}

function mostrarAcorde(clave) {
  claveActual = clave;
  const acorde = acordeDe(clave);

  panel.dataset.vacio = acorde ? 'no' : 'si';
  escenario.style.setProperty('--acento', acorde ? colorDe(acorde) : 'var(--marfil)');

  if (acorde) {
    elGrado.textContent = acorde.romano;
    if (acorde.septima) {
      const marca = document.createElement('span');
      marca.className = 'acorde__siete';
      marca.textContent = '7';
      elGrado.append(marca);
    }
    if (acorde.variante) {
      const etiqueta = document.createElement('span');
      etiqueta.className = 'acorde__sus';
      etiqueta.textContent = acorde.variante;
      elGrado.append(etiqueta);
    }
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
    item.setAttribute('aria-current', String(Number(item.dataset.grado) === acorde?.grado));
  }

  if (acorde) sonido.tocar(acorde);
  else sonido.soltar();
}

/** Deja la pantalla y el sonido sin acorde (al pausar o ante un error). */
function quedarSinAcorde() {
  estabilizador.reiniciar();
  dedos = null;
  dedosDeLaOtra = null;
  variante = null;
  septima = false;
  referenciaDelPulgar = null;
  if (claveActual !== null) mostrarAcorde(null);
  mostrarInclinacion(null);
  mostrarSeptima(false);
}

/**
 * Indicador de séptima: se enciende con la otra mano abierta.
 * @param {boolean} hayOtraMano Si la otra mano está a la vista.
 */
function mostrarSeptima(hayOtraMano) {
  elSeptima.dataset.mano = hayOtraMano ? 'si' : 'no';
  elSeptima.dataset.activa = septima ? 'si' : 'no';
  const texto = septima ? `mano ${MANO.otra} abierta` : `abrí la mano ${MANO.otra}`;
  if (elSeptimaTexto.textContent !== texto) elSeptimaTexto.textContent = texto;
}

/**
 * Indicador de inclinación: un punto que se mueve con la mano entre los dos
 * lados. Las etiquetas se ubican según hacia dónde se ve "afuera" en pantalla.
 * @param {number|null} gradosEnImagen Inclinación medida en la imagen, o null sin mano.
 */
function mostrarInclinacion(gradosEnImagen) {
  const espejado = escenario.dataset.espejo === 'si';
  // Afuera del cuerpo es la derecha de la persona con la mano derecha, que en
  // el cuadro sin espejar queda a la izquierda; el espejo lo vuelve a la derecha.
  const afueraALaDerecha = (MANO.etiqueta === 'Right') === espejado;
  const derecha = afueraALaDerecha ? 'sus4' : 'sus2';
  if (ladoDerecho.textContent !== derecha) {
    ladoDerecho.textContent = derecha;
    ladoIzquierdo.textContent = afueraALaDerecha ? 'sus2' : 'sus4';
  }
  ladoDerecho.dataset.activo = variante === ladoDerecho.textContent ? 'si' : 'no';
  ladoIzquierdo.dataset.activo = variante === ladoIzquierdo.textContent ? 'si' : 'no';

  elInclinacion.dataset.mano = gradosEnImagen === null ? 'no' : 'si';
  const enPantalla = gradosEnImagen === null ? 0 : espejado ? -gradosEnImagen : gradosEnImagen;
  inclinacionSuave = gradosEnImagen === null ? 0 : inclinacionSuave + 0.5 * (enPantalla - inclinacionSuave);
  const posicion = 50 + (Math.max(-RANGO_DEL_INDICADOR, Math.min(RANGO_DEL_INDICADOR, inclinacionSuave)) / RANGO_DEL_INDICADOR) * 50;
  elInclinacion.style.setProperty('--posicion', `${posicion.toFixed(1)}%`);
}

function mostrarPista(texto) {
  if (texto === pistaActual) return;
  pistaActual = texto;
  if (claveActual === null) elDetalle.textContent = texto;
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
  // Mano que agrega la séptima (la izquierda, salvo con ?mano=izquierda).
  const otra = elegirMano(resultado, MANO.etiquetaOtra).indice;
  let grado = null;
  let medidas = null;
  let inclinacion = null;

  if (indice >= 0) {
    // Los puntos "world" están en metros y no se deforman con la perspectiva.
    const mundo = resultado.worldLandmarks[indice];
    medidas = medirDedos(mundo);
    dedos = actualizarDedos(dedos, medidas);
    grado = gradoDeLaSena(dedos);

    // Inclinación lateral de la mano: afuera del cuerpo = sus4, adentro = sus2.
    const soloPulgar = esSoloPulgar(dedos);
    inclinacion = medirInclinacion(resultado.landmarks[indice], mundo, video.videoWidth / video.videoHeight, {
      soloPulgar,
      referencia: soloPulgar ? referenciaDelPulgar : null,
    });
    referenciaDelPulgar = soloPulgar ? inclinacion.referencia : null;
    // En el cuadro sin espejar, la derecha de la persona queda a la izquierda.
    const haciaAfuera = MANO.etiqueta === 'Right' ? -inclinacion.grados : inclinacion.grados;
    variante = actualizarVariante(variante, haciaAfuera);
  } else {
    dedos = null;
    variante = null;
    referenciaDelPulgar = null;
  }

  // Otra mano abierta = séptima. Sin esa mano a la vista, el acorde va sin séptima.
  let medidasDeLaOtra = null;
  if (otra >= 0 && otra !== indice) {
    medidasDeLaOtra = medirDedos(resultado.worldLandmarks[otra]);
    dedosDeLaOtra = actualizarDedos(dedosDeLaOtra, medidasDeLaOtra);
  } else {
    dedosDeLaOtra = null;
  }
  septima = esManoAbierta(dedosDeLaOtra);

  const estable = estabilizador.actualizar(claveDe(grado, variante, septima), ahora);
  if (estable !== claveActual) mostrarAcorde(estable);
  mostrarInclinacion(inclinacion ? inclinacion.grados : null);
  mostrarSeptima(dedosDeLaOtra !== null);

  if (indice >= 0) {
    // Mientras una seña válida se está por confirmar, no se cambia el texto.
    if (grado === null) mostrarPista('Esa seña no tiene un acorde asignado.');
  } else if (hayOtraMano) {
    mostrarPista(`Los acordes se eligen con la mano ${MANO.nombre}; la ${MANO.otra} abierta agrega la séptima.`);
  } else mostrarPista(`Mostrá tu mano ${MANO.nombre} a la cámara.`);

  // Trazo de las manos sobre el video.
  ajustarLienzo(lienzo);
  limpiar(lienzo);
  const acorde = acordeDe(estable);
  const color = acorde ? colorDe(acorde) : '#f7f0e3';
  (resultado.landmarks ?? []).forEach((puntos, i) => {
    if (i === indice) dibujarMano(lienzo, video, puntos, { dedos, color });
    // La otra mano se ve con sus dedos marcados solo cuando está abierta.
    else if (i === otra && septima) dibujarMano(lienzo, video, puntos, { dedos: dedosDeLaOtra, color });
    else dibujarMano(lienzo, video, puntos);
  });

  if (DEPURAR) {
    elMedidas.hidden = false;
    const lineas = medidas
      ? [
          ...DEDOS.map((d) => `${d.padEnd(8)}${medidas[d].toFixed(2).padStart(6)}  ${dedos[d] ? '▲' : '·'}`),
          `inclin. ${inclinacion.grados.toFixed(0).padStart(5)}°  ${variante ?? '·'}${inclinacion.referencia === 'pulgar' ? ' (pulgar)' : ''}`,
        ]
      : ['sin mano'];
    lineas.push(
      '',
      medidasDeLaOtra
        ? `${MANO.otra}: ${DEDOS.slice(1).map((d) => medidasDeLaOtra[d].toFixed(2)).join(' ')}  7ª ${septima ? '▲' : '·'}`
        : `${MANO.otra}: sin mano`,
    );
    elMedidas.textContent = lineas.join('\n');
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
      quedarSinAcorde();
      actualizarBotonDeSonido();
      mostrarAviso('El reconocimiento de manos dejó de responder. Volvé a intentar.', { reintentar: true });
    }
    return;
  }
  procesar(resultado, ahora);
}

// ---------- Arranque ----------

async function iniciar() {
  enMarcha = false;
  actualizarBotonDeSonido();
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
  // Se intenta habilitar el audio de entrada; si el navegador pide un toque,
  // queda a la vista el botón "Activar sonido".
  sonido.activar();
  actualizarBotonDeSonido();
  requestAnimationFrame(cuadro);
}

armarGuia();
armarControles();
elInclinacion.style.setProperty('--umbral', `${(UMBRALES.inclinacion.entrar / RANGO_DEL_INDICADOR) * 50}%`);
mostrarInclinacion(null);
mostrarSeptima(false);
mostrarAcorde(null);
mostrarPista(`Mostrá tu mano ${MANO.nombre} a la cámara.`);

botonReintentar.addEventListener('click', iniciar);
botonCamara.addEventListener('click', cambiarCamara);
window.addEventListener('resize', () => ajustarLienzo(lienzo));
// Con la pestaña oculta el video deja de analizarse: se corta el acorde
// para que no quede sonando sin que nadie lo sostenga.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) quedarSinAcorde();
});

iniciar();
