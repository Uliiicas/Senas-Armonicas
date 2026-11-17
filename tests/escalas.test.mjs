import test from 'node:test';
import assert from 'node:assert/strict';

import { ESCALAS, construirEscala } from '../js/escalas.js';

test('Do Mayor tiene los siete acordes esperados', () => {
  const escala = ESCALAS['do-mayor'];
  assert.equal(escala.nombre, 'Do Mayor');
  assert.deepEqual(
    escala.acordes.map((a) => [a.romano, a.nombre, a.cifrado, a.notas.join(' ')]),
    [
      ['I', 'Do mayor', 'C', 'Do Mi Sol'],
      ['ii', 'Re menor', 'Dm', 'Re Fa La'],
      ['iii', 'Mi menor', 'Em', 'Mi Sol Si'],
      ['IV', 'Fa mayor', 'F', 'Fa La Do'],
      ['V', 'Sol mayor', 'G', 'Sol Si Re'],
      ['vi', 'La menor', 'Am', 'La Do Mi'],
      ['vii°', 'Si disminuido', 'B°', 'Si Re Fa'],
    ],
  );
});

test('las notas MIDI de Do Mayor arrancan en el Do central', () => {
  const { acordes } = ESCALAS['do-mayor'];
  assert.deepEqual(acordes[0].midi, [60, 64, 67]);
  assert.deepEqual(acordes[5].midi, [69, 72, 76]);
  assert.deepEqual(acordes[6].midi, [71, 74, 77]);
});

test('otras tonalidades se escriben con las alteraciones correctas', () => {
  assert.deepEqual(construirEscala({ tonica: 'Sol' }).notas, ['Sol', 'La', 'Si', 'Do', 'Re', 'Mi', 'Fa♯']);
  assert.deepEqual(construirEscala({ tonica: 'Fa' }).notas, ['Fa', 'Sol', 'La', 'Si♭', 'Do', 'Re', 'Mi']);
  assert.deepEqual(
    construirEscala({ tonica: 'Mi', alteracion: -1 }).notas,
    ['Mi♭', 'Fa', 'Sol', 'La♭', 'Si♭', 'Do', 'Re'],
  );
});

test('cada grado de Do Mayor tiene sus variantes sus2 y sus4', () => {
  const { acordes } = ESCALAS['do-mayor'];
  const fila = (v) => [v.romano, v.nombre, v.cifrado, v.notas.join(' ')];
  assert.deepEqual(acordes.map((a) => fila(a.variantes.sus4)), [
    ['I', 'Do sus4', 'Csus4', 'Do Fa Sol'],
    ['II', 'Re sus4', 'Dsus4', 'Re Sol La'],
    ['III', 'Mi sus4', 'Esus4', 'Mi La Si'],
    ['IV', 'Fa sus4', 'Fsus4', 'Fa Si♭ Do'],
    ['V', 'Sol sus4', 'Gsus4', 'Sol Do Re'],
    ['VI', 'La sus4', 'Asus4', 'La Re Mi'],
    ['VII', 'Si sus4 (♭5)', 'Bsus4(♭5)', 'Si Mi Fa'],
  ]);
  assert.deepEqual(acordes.map((a) => fila(a.variantes.sus2)), [
    ['I', 'Do sus2', 'Csus2', 'Do Re Sol'],
    ['II', 'Re sus2', 'Dsus2', 'Re Mi La'],
    ['III', 'Mi sus2', 'Esus2', 'Mi Fa♯ Si'],
    ['IV', 'Fa sus2', 'Fsus2', 'Fa Sol Do'],
    ['V', 'Sol sus2', 'Gsus2', 'Sol La Re'],
    ['VI', 'La sus2', 'Asus2', 'La Si Mi'],
    ['VII', 'Si sus2 (♭5)', 'Bsus2(♭5)', 'Si Do♯ Fa'],
  ]);
});

test('las variantes sus cambian solo la tercera', () => {
  const { acordes } = ESCALAS['do-mayor'];
  assert.deepEqual(acordes[0].variantes.sus4.midi, [60, 65, 67]);
  assert.deepEqual(acordes[0].variantes.sus2.midi, [60, 62, 67]);
  assert.deepEqual(acordes[3].variantes.sus4.midi, [65, 70, 72]);
  for (const acorde of acordes) {
    for (const v of Object.values(acorde.variantes)) {
      assert.equal(v.midi[0], acorde.midi[0]);
      assert.equal(v.midi[2], acorde.midi[2]);
      assert.equal(v.grado, acorde.grado);
    }
  }
});

test('cada grado de Do Mayor tiene su acorde con séptima', () => {
  const { acordes } = ESCALAS['do-mayor'];
  assert.deepEqual(
    acordes.map((a) => [a.conSeptima.romano, a.conSeptima.nombre, a.conSeptima.cifrado, a.conSeptima.notas.join(' ')]),
    [
      ['I', 'Do séptima mayor', 'Cmaj7', 'Do Mi Sol Si'],
      ['ii', 'Re menor séptima', 'Dm7', 'Re Fa La Do'],
      ['iii', 'Mi menor séptima', 'Em7', 'Mi Sol Si Re'],
      ['IV', 'Fa séptima mayor', 'Fmaj7', 'Fa La Do Mi'],
      ['V', 'Sol séptima', 'G7', 'Sol Si Re Fa'],
      ['vi', 'La menor séptima', 'Am7', 'La Do Mi Sol'],
      ['viiø', 'Si semidisminuido', 'Bm7(♭5)', 'Si Re Fa La'],
    ],
  );
  assert.deepEqual(acordes[0].conSeptima.midi, [60, 64, 67, 71]);
  assert.deepEqual(acordes[4].conSeptima.midi, [67, 71, 74, 77]);
  for (const acorde of acordes) {
    assert.equal(acorde.septima, false);
    assert.equal(acorde.conSeptima.septima, true);
    assert.deepEqual(acorde.conSeptima.midi.slice(0, 3), acorde.midi, 'la tríada no cambia');
  }
});

test('los acordes suspendidos también tienen su versión con séptima', () => {
  const { acordes } = ESCALAS['do-mayor'];
  const fila = (v) => [v.cifrado, v.notas.join(' ')];
  assert.deepEqual(fila(acordes[0].variantes.sus4.conSeptima), ['Cmaj7sus4', 'Do Fa Sol Si']);
  assert.deepEqual(fila(acordes[1].variantes.sus2.conSeptima), ['D7sus2', 'Re Mi La Do']);
  assert.deepEqual(fila(acordes[4].variantes.sus4.conSeptima), ['G7sus4', 'Sol Do Re Fa']);
  assert.deepEqual(fila(acordes[6].variantes.sus4.conSeptima), ['B7sus4(♭5)', 'Si Mi Fa La']);
  assert.equal(acordes[4].variantes.sus4.conSeptima.nombre, 'Sol séptima sus4');
  for (const acorde of acordes) {
    for (const v of Object.values(acorde.variantes)) {
      assert.equal(v.conSeptima.variante, v.variante);
      assert.deepEqual(v.conSeptima.midi, [...v.midi, acorde.conSeptima.midi[3]], 'misma séptima de la escala');
    }
  }
});
