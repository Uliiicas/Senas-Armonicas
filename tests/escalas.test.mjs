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
