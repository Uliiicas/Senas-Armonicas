import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SENAS,
  medirDedos,
  actualizarDedos,
  gradoDeLaSena,
  elegirMano,
  Estabilizador,
} from '../js/gestos.js';
import { manoLocal, girar, conRuido, azarConSemilla, formaDeLaSena } from './mano-sintetica.mjs';

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
