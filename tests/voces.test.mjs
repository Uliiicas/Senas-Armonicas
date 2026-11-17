import test from 'node:test';
import assert from 'node:assert/strict';

import { ESCALAS } from '../js/escalas.js';
import { frecuencia, enVentana, vocesDePiano, vocesDeVientos } from '../js/voces.js';

const { acordes } = ESCALAS['do-mayor'];
const clases = (notas) => [...new Set(notas.map((n) => n % 12))].sort((a, b) => a - b);

test('frecuencia: La4 = 440 Hz y Do central ≈ 261,63 Hz', () => {
  assert.equal(frecuencia(69), 440);
  assert.ok(Math.abs(frecuencia(60) - 261.63) < 0.01);
});

test('enVentana conserva la nota y la lleva a la octava pedida', () => {
  assert.equal(enVentana(60, 57), 60);
  assert.equal(enVentana(77, 57), 65);
  assert.equal(enVentana(55, 57), 67);
  assert.equal(enVentana(48, 64), 72);
});

test('el piano toca solo notas del acorde, con la fundamental en el bajo', () => {
  for (const acorde of acordes) {
    const voces = vocesDePiano(acorde.midi);
    assert.equal(voces.length, 4);
    assert.deepEqual(clases(voces.map((v) => v.midi)), clases(acorde.midi), acorde.nombre);
    assert.equal(voces[0].midi % 12, acorde.midi[0] % 12, `bajo de ${acorde.nombre}`);
    assert.ok(voces[0].midi >= 43 && voces[0].midi < 55);
    voces.slice(1).forEach((v) => assert.ok(v.midi >= 57 && v.midi < 69));
  }
  assert.deepEqual(vocesDePiano(acordes[0].midi).map((v) => v.midi), [48, 60, 64, 67]);
});

test('los vientos son dos trombones y tres trompetas con notas del acorde', () => {
  for (const acorde of acordes) {
    const voces = vocesDeVientos(acorde.midi);
    assert.deepEqual(voces.map((v) => v.tipo), ['trombon', 'trombon', 'trompeta', 'trompeta', 'trompeta']);
    assert.deepEqual(clases(voces.map((v) => v.midi)), clases(acorde.midi), acorde.nombre);
    assert.equal(voces[0].midi % 12, acorde.midi[0] % 12, `trombón grave de ${acorde.nombre}`);
    voces.slice(2).forEach((v) => assert.ok(v.midi >= 64 && v.midi < 76));
  }
});

test('al cambiar de acorde las voces del piano se mueven poco', () => {
  for (let i = 0; i < acordes.length; i++) {
    for (let j = 0; j < acordes.length; j++) {
      const a = vocesDePiano(acordes[i].midi).slice(1).map((v) => v.midi);
      const b = vocesDePiano(acordes[j].midi).slice(1).map((v) => v.midi);
      a.forEach((nota, k) => assert.ok(Math.abs(nota - b[k]) < 12));
    }
  }
});
