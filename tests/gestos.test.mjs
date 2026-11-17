import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SENAS,
  medirDedos,
  actualizarDedos,
  gradoDeLaSena,
  elegirMano,
  Estabilizador,
  medirInclinacion,
  actualizarVariante,
  esSoloPulgar,
} from '../js/gestos.js';
import { manoLocal, girar, conRuido, azarConSemilla, formaDeLaSena, aImagen } from './mano-sintetica.mjs';

const leer = (puntos, anterior = null) => gradoDeLaSena(actualizarDedos(anterior, medirDedos(puntos)));

test('cada seña se reconoce como su grado con la mano de frente', () => {
  for (const [grado, patron] of Object.entries(SENAS)) {
    const mano = manoLocal(formaDeLaSena(patron));
    assert.equal(leer(mano), Number(grado), `grado ${grado}`);
  }
});

test('el reconocimiento no depende de la orientación de la mano ni de ruido leve', () => {
  const azar = azarConSemilla(7);
  let aciertos = 0;
  let total = 0;
  for (const [grado, patron] of Object.entries(SENAS)) {
    for (let i = 0; i < 300; i++) {
      const giro = [(azar() - 0.5) * 1.4, (azar() - 0.5) * 1.4, (azar() - 0.5) * 2 * Math.PI];
      const mano = conRuido(girar(manoLocal(formaDeLaSena(patron)), giro), 0.003, azar);
      total++;
      if (leer(mano) === Number(grado)) aciertos++;
    }
  }
  assert.ok(aciertos / total > 0.99, `aciertos: ${aciertos}/${total}`);
});

test('el pulgar pegado a la mano o cruzado sobre la palma cuenta como plegado', () => {
  for (const pulgar of ['pegado', 'cruzado']) {
    const cuatro = manoLocal({ curvatura: [0.05, 0.05, 0.05, 0.05], pulgar });
    assert.equal(leer(cuatro), 4, `cuatro dedos con pulgar ${pulgar}`);
    const uno = manoLocal({ curvatura: [0.05, 0.95, 0.95, 0.95], pulgar });
    assert.equal(leer(uno), 1, `índice con pulgar ${pulgar}`);
  }
});

test('la mano abierta con el pulgar relajado sigue siendo el grado V', () => {
  const mano = manoLocal({ curvatura: [0.05, 0.05, 0.05, 0.05], pulgar: 'relajado' });
  assert.equal(leer(mano), 5);
});

test('el puño y las señas que no están en la tabla no dan acorde', () => {
  const puno = manoLocal({ curvatura: [0.95, 0.95, 0.95, 0.95], pulgar: 'cruzado' });
  assert.equal(leer(puno), null);
  const cuernos = manoLocal({ curvatura: [0.05, 0.95, 0.95, 0.05], pulgar: 'cruzado' });
  assert.equal(leer(cuernos), null);
  const soloMenique = manoLocal({ curvatura: [0.95, 0.95, 0.95, 0.05], pulgar: 'cruzado' });
  assert.equal(leer(soloMenique), null);
});

test('la histéresis sostiene el estado mientras un dedo está a medio camino', () => {
  const medidasBase = { pulgar: -0.5, medio: 0.3, anular: 0.3, menique: 0.3 };
  let dedos = actualizarDedos(null, { ...medidasBase, indice: 0.95 });
  assert.equal(dedos.indice, true);
  dedos = actualizarDedos(dedos, { ...medidasBase, indice: 0.8 });
  assert.equal(dedos.indice, true, 'en la franja intermedia conserva levantado');
  dedos = actualizarDedos(dedos, { ...medidasBase, indice: 0.7 });
  assert.equal(dedos.indice, false);
  dedos = actualizarDedos(dedos, { ...medidasBase, indice: 0.8 });
  assert.equal(dedos.indice, false, 'en la franja intermedia conserva plegado');
});

test('elegirMano toma solo la mano pedida y avisa si se ve la otra', () => {
  const mano = (nombre, score) => [{ categoryName: nombre, score }];
  assert.deepEqual(elegirMano({ handedness: [] }, 'Right'), { indice: -1, hayOtraMano: false });
  assert.deepEqual(elegirMano({ handedness: [mano('Left', 0.9)] }, 'Right'), { indice: -1, hayOtraMano: true });
  assert.deepEqual(
    elegirMano({ handedness: [mano('Left', 0.99), mano('Right', 0.8)] }, 'Right'),
    { indice: 1, hayOtraMano: false },
  );
  assert.deepEqual(
    elegirMano({ handedness: [mano('Right', 0.7), mano('Right', 0.9)] }, 'Right'),
    { indice: 1, hayOtraMano: false },
  );
});

test('el estabilizador ignora señas fugaces y demora un poco más el silencio', () => {
  const e = new Estabilizador({ acorde: 100, silencio: 200 });
  assert.equal(e.actualizar(1, 0), null);
  assert.equal(e.actualizar(1, 60), null);
  assert.equal(e.actualizar(1, 110), 1, 'se acepta al sostenerse 100 ms');

  // Paso fugaz por el grado II camino al III.
  assert.equal(e.actualizar(2, 130), 1);
  assert.equal(e.actualizar(3, 160), 1);
  assert.equal(e.actualizar(3, 270), 3);

  // Se pierde la seña: aguanta 200 ms antes de quedar sin acorde.
  assert.equal(e.actualizar(null, 300), 3);
  assert.equal(e.actualizar(null, 450), 3);
  assert.equal(e.actualizar(null, 510), null);

  // Un cuadro suelto sin seña no corta el acorde.
  assert.equal(e.actualizar(5, 600), null);
  assert.equal(e.actualizar(5, 710), 5);
  assert.equal(e.actualizar(null, 730), 5);
  assert.equal(e.actualizar(5, 760), 5);
  assert.equal(e.actualizar(null, 900), 5, 'el contador de silencio arranca de nuevo');
});

// Mano girada `grados` en el plano de la imagen (positivo = hacia la derecha
// de la imagen), con sus puntos 3D y su proyección como la daría MediaPipe.
const ASPECTO = 16 / 9;
function manoInclinada(patron, grados, extra = [0, 0]) {
  const mundo = girar(manoLocal(formaDeLaSena(patron)), [extra[0], extra[1], (-grados * Math.PI) / 180]);
  return { mundo, imagen: aImagen(mundo, { aspecto: ASPECTO }) };
}

test('medirInclinacion da el giro de la mano en la imagen', () => {
  for (const [grado, patron] of Object.entries(SENAS)) {
    if (Number(grado) === 6) continue;
    for (const grados of [-60, -30, -10, 0, 10, 30, 60]) {
      const { mundo, imagen } = manoInclinada(patron, grados);
      const medida = medirInclinacion(imagen, mundo, ASPECTO);
      // El modelo de mano no es simétrico: el nudillo del medio queda apenas corrido.
      assert.ok(Math.abs(medida.grados - grados) < 4, `grado ${grado} a ${grados}°: ${medida.grados.toFixed(1)}`);
      assert.equal(medida.referencia, 'eje');
    }
  }
});

test('inclinar la mano no cambia qué dedos se leen', () => {
  for (const [grado, patron] of Object.entries(SENAS)) {
    for (const grados of [-50, -30, 30, 50]) {
      const { mundo } = manoInclinada(patron, grados);
      assert.equal(leer(mundo), Number(grado), `grado ${grado} a ${grados}°`);
    }
  }
});

test('solo pulgar con la mano levantada: la referencia es el eje de la mano', () => {
  for (const grados of [-50, -30, 0, 30, 50]) {
    const { mundo, imagen } = manoInclinada(SENAS[6], grados);
    const dedos = actualizarDedos(null, medirDedos(mundo));
    assert.ok(esSoloPulgar(dedos));
    const medida = medirInclinacion(imagen, mundo, ASPECTO, { soloPulgar: true });
    assert.equal(medida.referencia, 'eje', `a ${grados}°`);
    assert.ok(Math.abs(medida.grados - grados) < 4);
  }
});

test('solo pulgar con el puño hacia la cámara: la referencia es el pulgar', () => {
  // Puño volcado hacia la cámara: el eje muñeca-nudillo casi no se ve.
  const { mundo, imagen } = manoInclinada(SENAS[6], 0, [1.2, 0]);
  const medida = medirInclinacion(imagen, mundo, ASPECTO, { soloPulgar: true });
  assert.equal(medida.referencia, 'pulgar');
  const pulgarEnReposo = medida.grados;
  for (const grados of [-35, 35]) {
    const girada = manoInclinada(SENAS[6], grados, [1.2, 0]);
    const m = medirInclinacion(girada.imagen, girada.mundo, ASPECTO, { soloPulgar: true });
    assert.equal(m.referencia, 'pulgar');
    assert.ok(Math.abs(m.grados - pulgarEnReposo - grados) < 1, `${m.grados.toFixed(1)} a ${grados}°`);
  }
});

test('otra seña apuntando a la cámara: no se interpreta inclinación', () => {
  const { mundo, imagen } = manoInclinada(SENAS[1], 40, [1.2, 0]);
  assert.deepEqual(medirInclinacion(imagen, mundo, ASPECTO), { grados: 0, referencia: null });
});

test('la referencia elegida se conserva mientras dura la seña', () => {
  const { mundo, imagen } = manoInclinada(SENAS[6], 30, [1.2, 0]);
  const fijada = medirInclinacion(imagen, mundo, ASPECTO, { soloPulgar: true, referencia: 'eje' });
  assert.equal(fijada.referencia, 'eje');
});

test('actualizarVariante: afuera es sus4, adentro es sus2, con histéresis', () => {
  assert.equal(actualizarVariante(null, 0), null);
  assert.equal(actualizarVariante(null, 20), null, 'en la franja intermedia no entra');
  assert.equal(actualizarVariante(null, 26), 'sus4');
  assert.equal(actualizarVariante('sus4', 20), 'sus4', 'en la franja intermedia se sostiene');
  assert.equal(actualizarVariante('sus4', 16), null);
  assert.equal(actualizarVariante(null, -26), 'sus2');
  assert.equal(actualizarVariante('sus2', -20), 'sus2');
  assert.equal(actualizarVariante('sus2', -16), null);
  assert.equal(actualizarVariante('sus4', -20), null, 'no se hereda el lado contrario');
  assert.equal(actualizarVariante('sus2', 40), 'sus4');
  assert.equal(actualizarVariante('sus4', 170), null, 'mano cabeza abajo: no se interpreta');
});
