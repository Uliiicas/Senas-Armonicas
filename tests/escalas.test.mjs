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
