// Motor de sonido: arma la cadena de audio y hace sonar los acordes.
//
//   instrumento → [coro estéreo] ─┬──────────────→ volumen → limitador → salida
//                                 └→ reverberación ↗

import { INSTRUMENTOS, INSTRUMENTO_INICIAL } from './instrumentos.js';

// Ganancia con la barra de volumen al máximo. Con los niveles de cada
// instrumento, al máximo los picos quedan unos 3 a 5 dB por debajo del tope,
// y con la barra en su valor inicial (60 %) unos 9 dB más abajo todavía:
// volumen moderado, con margen para subirlo.
const GANANCIA_MAXIMA = 1;

/** Posición inicial de la barra de volumen (0 a 1). */
export const VOLUMEN_INICIAL = 0.6;

/** La barra es lineal para la mano pero el oído no: se eleva al cuadrado. */
export function gananciaDeVolumen(volumen) {
  const v = Math.min(Math.max(volumen, 0), 1);
  return v * v * GANANCIA_MAXIMA;
}

/** Coro estéreo: dos copias con un retardo que oscila lento, una a cada lado. */
function armarCoro(ctx, entrada, salida) {
  const seco = ctx.createGain();
  seco.gain.value = 0.85;
  entrada.connect(seco).connect(salida);

  [
    { retardo: 0.012, profundidad: 0.0022, velocidad: 0.43, pan: -0.7 },
    { retardo: 0.017, profundidad: 0.0028, velocidad: 0.61, pan: 0.7 },
  ].forEach(({ retardo, profundidad, velocidad, pan }) => {
    const linea = ctx.createDelay(0.05);
    linea.delayTime.value = retardo;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = velocidad;
    const cantidad = ctx.createGain();
    cantidad.gain.value = profundidad;
    lfo.connect(cantidad).connect(linea.delayTime);
    lfo.start();
    const nivel = ctx.createGain();
    nivel.gain.value = 0.38;
    const paneo = ctx.createStereoPanner();
    paneo.pan.value = pan;
    entrada.connect(linea).connect(nivel).connect(paneo).connect(salida);
  });
}

/** Reverberación de sala: ruido que se apaga, usado como respuesta al impulso. */
function armarReverberacion(ctx) {
  const segundos = 2;
  const largo = Math.round(ctx.sampleRate * segundos);
  const impulso = ctx.createBuffer(2, largo, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const datos = impulso.getChannelData(canal);
    let suave = 0;
    for (let i = 0; i < largo; i++) {
      const t = i / ctx.sampleRate;
      // Filtro simple para que la cola sea más oscura que el sonido directo.
      suave += 0.35 * (Math.random() * 2 - 1 - suave);
      datos[i] = suave * Math.exp(-t / 0.42);
    }
  }
  const sala = ctx.createConvolver();
  sala.buffer = impulso;
  return sala;
}

export class Sonido {
  /**
   * @param {object} [opciones]
   * @param {string} [opciones.instrumento] Clave de INSTRUMENTOS.
   * @param {number} [opciones.volumen] De 0 a 1.
   * @param {(activo:boolean)=>void} [opciones.alCambiarEstado] Avisa si el audio está en marcha.
   */
  constructor({ instrumento = INSTRUMENTO_INICIAL, volumen = VOLUMEN_INICIAL, alCambiarEstado } = {}) {
    this.instrumento = INSTRUMENTOS[instrumento] ? instrumento : INSTRUMENTO_INICIAL;
    this.volumen = volumen;
    this.alCambiarEstado = alCambiarEstado;
    this.ctx = null;
    this.acorde = null; // acorde que debería estar sonando
    this.sonando = null; // { soltar, instrumento } de lo que suena
  }

  /** Arma la cadena de audio sobre un contexto (real o fuera de línea). */
  conectar(ctx) {
    this.ctx = ctx;

    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -8;
    limitador.knee.value = 6;
    limitador.ratio.value = 12;
    limitador.attack.value = 0.003;
    limitador.release.value = 0.2;
    limitador.connect(ctx.destination);

    this.maestro = ctx.createGain();
    this.maestro.gain.value = gananciaDeVolumen(this.volumen);
    this.maestro.connect(limitador);

    const mezcla = ctx.createGain();
    mezcla.connect(this.maestro);
    const envio = ctx.createGain();
    envio.gain.value = 0.16;
    mezcla.connect(envio).connect(armarReverberacion(ctx)).connect(this.maestro);

    this.entradas = {};
    for (const [clave, instrumento] of Object.entries(INSTRUMENTOS)) {
      const entrada = ctx.createGain();
      entrada.gain.value = instrumento.nivel;
      if (instrumento.coro) armarCoro(ctx, entrada, mezcla);
      else entrada.connect(mezcla);
      this.entradas[clave] = entrada;
    }
    return this;
  }

  get activo() {
    return this.ctx?.state === 'running';
  }

  /**
   * Pone el audio en marcha. Los navegadores solo lo permiten después de un
   * toque, clic o tecla, así que conviene llamarla desde esos eventos.
   */
  activar() {
    if (!this.ctx) {
      const Contexto = window.AudioContext ?? window.webkitAudioContext;
      if (!Contexto) return;
      this.conectar(new Contexto({ latencyHint: 'interactive' }));
      this.ctx.addEventListener('statechange', () => this._alCambiarElContexto());
    }
    // No se espera la promesa: sin un gesto del usuario queda pendiente.
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this._alCambiarElContexto();
  }

  _alCambiarElContexto() {
    this.alCambiarEstado?.(this.activo);
    // Si había un acorde elegido mientras el audio estaba bloqueado, suena ahora.
    if (this.activo && this.acorde && !this.sonando) this._disparar();
    // Si el navegador pausa el audio, se suelta lo que sonaba para que no
    // quede una nota colgada al reanudar.
    if (!this.activo) this._apagar('cambio');
  }

  fijarVolumen(volumen) {
    this.volumen = volumen;
    if (!this.ctx) return;
    this.maestro.gain.setTargetAtTime(gananciaDeVolumen(volumen), this.ctx.currentTime, 0.03);
  }

  fijarInstrumento(clave) {
    if (!INSTRUMENTOS[clave] || clave === this.instrumento) return;
    this._apagar('cambio');
    this.instrumento = clave;
    if (this.activo && this.acorde) this._disparar();
  }

  /** Hace sonar un acorde (objeto de escalas.js) y apaga el anterior. */
  tocar(acorde, cuando) {
    this._apagar('cambio', cuando);
    this.acorde = acorde;
    if (this.activo || cuando !== undefined) this._disparar(cuando);
  }

  /** Deja de sonar: quedó sin acorde. */
  soltar(cuando) {
    this.acorde = null;
    this._apagar('silencio', cuando);
  }

  _disparar(cuando = this.ctx.currentTime + 0.01) {
    const instrumento = INSTRUMENTOS[this.instrumento];
    const nota = instrumento.tocar(this.ctx, this.entradas[this.instrumento], this.acorde, cuando);
    this.sonando = { soltar: nota.soltar, colas: instrumento.colas };
  }

  _apagar(motivo, cuando = this.ctx?.currentTime) {
    if (!this.sonando) return;
    this.sonando.soltar(cuando, this.sonando.colas[motivo]);
    this.sonando = null;
  }
}
