// Reparto de las notas de un acorde entre las voces de cada instrumento.
// Funciones puras sobre números MIDI, sin navegador.

/** Frecuencia en Hz de una nota MIDI (La4 = 69 = 440 Hz). */
export function frecuencia(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Lleva una nota a la octava que cae dentro de la ventana [desde, desde + 12).
 * Poner todas las notas en una misma ventana hace que, al cambiar de acorde,
 * cada voz se mueva lo menos posible en lugar de saltar en bloque.
 */
export function enVentana(midi, desde) {
  return desde + ((((midi - desde) % 12) + 12) % 12);
}

/**
 * Las tres notas que van arriba, en las voces agudas. En una tríada son las
 * tres; con séptima, la fundamental queda solo abajo (en el bajo o en el
 * trombón) y arriba suenan tercera, quinta y séptima. Así no se amontonan
 * cuatro notas en una octava, donde la séptima mayor chocaría a medio tono
 * con la fundamental.
 * @param {number[]} midi [fundamental, tercera, quinta] o [fundamental, tercera, quinta, séptima].
 */
export function notasDeArriba(midi) {
  return midi.length > 3 ? midi.slice(1, 4) : midi.slice(0, 3);
}

/**
 * Piano: un bajo con la fundamental y tres notas en el registro medio.
 * @param {number[]} midi Notas del acorde, de la fundamental para arriba (3 o 4).
 * @returns {Array<{midi:number, nivel:number}>} De grave a agudo.
 */
export function vocesDePiano(midi) {
  const bajo = { midi: enVentana(midi[0], 43), nivel: 0.9 }; // Sol2 a Fa♯3
  const arriba = notasDeArriba(midi)
    .map((nota) => enVentana(nota, 57)) // La3 a Sol♯4
    .sort((a, b) => a - b)
    .map((nota) => ({ midi: nota, nivel: 0.72 }));
  return [bajo, ...arriba];
}

/**
 * Sección de vientos de salsa: dos trombones abajo (fundamental y quinta)
 * y tres trompetas arriba en posición cerrada (la tríada, o tercera, quinta
 * y séptima si el acorde la tiene).
 * @param {number[]} midi Notas del acorde, de la fundamental para arriba (3 o 4).
 * @returns {Array<{midi:number, tipo:'trombon'|'trompeta', nivel:number, pan:number}>}
 */
export function vocesDeVientos(midi) {
  const [fundamental, , quinta] = midi;
  const trombones = [
    { midi: enVentana(fundamental, 48), tipo: 'trombon', nivel: 0.85, pan: -0.35 }, // Do3 a Si3
    { midi: enVentana(quinta, 53), tipo: 'trombon', nivel: 0.7, pan: -0.15 }, // Fa3 a Mi4
  ];
  const paneos = [0.1, 0.4, 0.25];
  const niveles = [0.7, 0.75, 0.9]; // la trompeta de arriba lleva la voz cantante
  const trompetas = notasDeArriba(midi)
    .map((nota) => enVentana(nota, 64)) // Mi4 a Re♯5
    .sort((a, b) => a - b)
    .map((nota, i) => ({ midi: nota, tipo: 'trompeta', nivel: niveles[i], pan: paneos[i] }));
  return [...trombones, ...trompetas];
}
