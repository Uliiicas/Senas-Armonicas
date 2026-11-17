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
 * Piano: un bajo con la fundamental y la tríada en el registro medio.
 * @param {number[]} midi Tríada del acorde [fundamental, tercera, quinta].
 * @returns {Array<{midi:number, nivel:number}>} De grave a agudo.
 */
export function vocesDePiano([fundamental, tercera, quinta]) {
  const bajo = { midi: enVentana(fundamental, 43), nivel: 0.9 }; // Sol2 a Fa♯3
  const triada = [fundamental, tercera, quinta]
    .map((nota) => enVentana(nota, 57)) // La3 a Sol♯4
    .sort((a, b) => a - b)
    .map((nota) => ({ midi: nota, nivel: 0.72 }));
  return [bajo, ...triada];
}

/**
 * Sección de vientos de salsa: dos trombones abajo (fundamental y quinta)
 * y tres trompetas arriba con la tríada cerrada.
 * @param {number[]} midi Tríada del acorde [fundamental, tercera, quinta].
 * @returns {Array<{midi:number, tipo:'trombon'|'trompeta', nivel:number, pan:number}>}
 */
export function vocesDeVientos([fundamental, tercera, quinta]) {
  const trombones = [
    { midi: enVentana(fundamental, 48), tipo: 'trombon', nivel: 0.85, pan: -0.35 }, // Do3 a Si3
    { midi: enVentana(quinta, 53), tipo: 'trombon', nivel: 0.7, pan: -0.15 }, // Fa3 a Mi4
  ];
  const paneos = [0.1, 0.4, 0.25];
  const niveles = [0.7, 0.75, 0.9]; // la trompeta de arriba lleva la voz cantante
  const trompetas = [fundamental, tercera, quinta]
    .map((nota) => enVentana(nota, 64)) // Mi4 a Re♯5
    .sort((a, b) => a - b)
    .map((nota, i) => ({ midi: nota, tipo: 'trompeta', nivel: niveles[i], pan: paneos[i] }));
  return [...trombones, ...trompetas];
}
