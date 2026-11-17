// Los instrumentos, sintetizados con Web Audio (sin archivos de sonido).
//
// Cada instrumento tiene una función `tocar(ctx, salida, acorde, cuando)`
// que arma las voces del acorde y devuelve `{ soltar(cuando, cola) }`.
// `cola` es la constante de tiempo (en segundos) con la que se apaga.

import { frecuencia, vocesDePiano, vocesDeVientos } from './voces.js';

const ruidos = new WeakMap();

/** Medio segundo de ruido blanco, compartido por contexto de audio. */
function ruidoBlanco(ctx) {
  let ruido = ruidos.get(ctx);
  if (!ruido) {
    ruido = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
    const datos = ruido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    ruidos.set(ctx, ruido);
  }
  return ruido;
}

/** Compuerta final de un acorde: permite apagarlo sin tocar las envolventes. */
function compuerta(ctx, salida, fuentes) {
  const puerta = ctx.createGain();
  puerta.gain.value = 1;
  puerta.connect(salida);
  let suelto = false;
  return {
    puerta,
    soltar(cuando, cola) {
      if (suelto) return;
      suelto = true;
      const t = Math.max(cuando, ctx.currentTime);
      puerta.gain.setValueAtTime(1, t);
      puerta.gain.setTargetAtTime(0, t, cola);
      const fin = t + cola * 8 + 0.05;
      fuentes.forEach((fuente) => {
        try {
          fuente.stop(fin);
        } catch {
          // La fuente ya había terminado.
        }
      });
      const ultima = fuentes[fuentes.length - 1];
      if (ultima) ultima.onended = () => puerta.disconnect();
    },
  };
}

// ---------- Piano eléctrico de cola (al estilo del Yamaha CP70) ----------
//
// El CP70 es un piano de cuerdas reales con micrófonos de contacto: ataque
// de martillo, timbre brillante y algo metálico, y notas que quedan sonando
// mucho tiempo. Cada nota se arma sumando sus armónicos uno por uno:
//  - levemente desafinados hacia arriba, como en una cuerda rígida y corta;
//  - los agudos se apagan antes que los graves, así el sonido se va
//    redondeando mientras se sostiene;
//  - una segunda "cuerda" apenas desafinada da el batido natural del unísono.

const ARMONICOS_PIANO = [1, 0.72, 0.5, 0.4, 0.28, 0.2, 0.14, 0.1];

function tocarPiano(ctx, salida, acorde, cuando) {
  const fuentes = [];
  const acordeSonando = compuerta(ctx, salida, fuentes);
  const { puerta } = acordeSonando;

  vocesDePiano(acorde.midi).forEach((voz, i) => {
    const t = cuando + i * 0.007; // las notas entran levemente arpegiadas
    const f = frecuencia(voz.midi);
    const rigidez = voz.midi < 55 ? 0.0009 : 0.0005;
    // Sustain largo: la fundamental tarda entre 7 y 9 s en caer a un tercio.
    const sustain = 9 - (voz.midi - 43) * 0.08;

    ARMONICOS_PIANO.forEach((amplitud, k) => {
      const n = k + 1;
      const fn = n * f * Math.sqrt(1 + rigidez * n * n);
      if (fn > 9000) return;
      const nivel = amplitud * voz.nivel;
      const caida = sustain / (1 + 0.45 * k);

      const cuerdas = n <= 2 ? [[0, 1], [1.8, 0.5]] : [[0, 1]];
      cuerdas.forEach(([desafinacion, peso]) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = fn;
        osc.detune.value = desafinacion + (Math.random() - 0.5) * 2;
        const env = ctx.createGain();
        const pico = nivel * peso;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(pico, t + 0.004);
        // Golpe inicial que cae rápido, y después la cola larga.
        env.gain.setTargetAtTime(pico * 0.5, t + 0.004, 0.1);
        env.gain.setTargetAtTime(0, t + 0.45, caida);
        osc.connect(env).connect(puerta);
        osc.start(t);
        fuentes.push(osc);
      });
    });

    // Golpe del martillo: un soplo muy corto de ruido filtrado.
    const martillo = ctx.createBufferSource();
    martillo.buffer = ruidoBlanco(ctx);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = Math.min(1600 + f * 2, 5000);
    filtro.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.22 * voz.nivel, t);
    env.gain.setTargetAtTime(0, t, 0.012);
    martillo.connect(filtro).connect(env).connect(puerta);
    martillo.start(t, Math.random() * 0.3, 0.12);
  });

  return acordeSonando;
}

// ---------- Vientos de salsa (trompetas y trombones) ----------
//
// Cada músico es una onda diente de sierra (rica en armónicos, como un metal)
// que pasa por un filtro. El carácter de metal sale de cuatro gestos:
//  - el filtro se abre de golpe en el ataque y después se asienta: el
//    "bap" acentuado de la sección;
//  - la nota entra un poco baja y sube a su altura, como al soplar;
//  - el vibrato aparece recién cuando la nota se sostiene;
//  - cada músico entra unos milisegundos distinto y apenas desafinado.

const METALES = {
  trompeta: { brillo: 7, reposo: 4.5, tope: 6500, topeReposo: 4200, formante: 1500, vibrato: 11, q: 1.6 },
  trombon: { brillo: 6, reposo: 4, tope: 3200, topeReposo: 2200, formante: 700, vibrato: 5, q: 1.2 },
};

function tocarVientos(ctx, salida, acorde, cuando) {
  const fuentes = [];
  const acordeSonando = compuerta(ctx, salida, fuentes);
  const { puerta } = acordeSonando;

  vocesDeVientos(acorde.midi).forEach((voz) => {
    const metal = METALES[voz.tipo];
    const t = cuando + Math.random() * 0.018;
    const f = frecuencia(voz.midi);

    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = metal.q;
    filtro.frequency.setValueAtTime(f * 1.2, t);
    filtro.frequency.linearRampToValueAtTime(Math.min(f * metal.brillo, metal.tope), t + 0.045);
    filtro.frequency.setTargetAtTime(Math.min(f * metal.reposo, metal.topeReposo), t + 0.045, 0.18);

    // Resonancia de la campana del instrumento.
    const formante = ctx.createBiquadFilter();
    formante.type = 'peaking';
    formante.frequency.value = metal.formante;
    formante.Q.value = 1.4;
    formante.gain.value = 6;

    // Ataque acentuado que afloja apenas: nota sostenida mientras dure la seña.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(voz.nivel, t + 0.03);
    env.gain.setTargetAtTime(voz.nivel * 0.78, t + 0.03, 0.15);

    const paneo = ctx.createStereoPanner();
    paneo.pan.value = voz.pan;

    filtro.connect(formante).connect(env).connect(paneo).connect(puerta);

    // Vibrato que crece después del ataque.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5.2 + Math.random() * 0.7;
    const profundidad = ctx.createGain();
    profundidad.gain.setValueAtTime(0, t);
    profundidad.gain.setTargetAtTime(metal.vibrato, t + 0.25, 0.3);
    lfo.connect(profundidad);
    lfo.start(t);
    fuentes.push(lfo);

    const afinacion = (Math.random() - 0.5) * 10;
    [[0, 1], [7, 0.6]].forEach(([desafinacion, peso]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const base = afinacion + desafinacion;
      osc.detune.setValueAtTime(base - 40, t);
      osc.detune.setTargetAtTime(base, t, 0.018);
      profundidad.connect(osc.detune);
      const mezcla = ctx.createGain();
      mezcla.gain.value = peso;
      osc.connect(mezcla).connect(filtro);
      osc.start(t);
      fuentes.push(osc);
    });
  });

  return acordeSonando;
}

/**
 * Instrumentos disponibles. Para sumar uno, agregalo acá.
 * - nivel: ganancia para que todos suenen parejos y sin saturar.
 * - coro: si pasa por el efecto de coro estéreo.
 * - colas: cómo se apaga al cambiar de acorde y al quedar sin acorde.
 */
export const INSTRUMENTOS = {
  piano: {
    nombre: 'Piano eléctrico',
    corto: 'Piano',
    tocar: tocarPiano,
    nivel: 0.13,
    coro: true,
    colas: { cambio: 0.35, silencio: 0.8 },
  },
  vientos: {
    nombre: 'Vientos de salsa',
    corto: 'Vientos',
    tocar: tocarVientos,
    nivel: 0.14,
    coro: false,
    colas: { cambio: 0.05, silencio: 0.07 },
  },
};

export const INSTRUMENTO_INICIAL = 'piano';
