// Teoría musical: construye una escala y los acordes (tríadas) de cada grado.
// No depende del navegador, así que se puede probar con `node --test`.

const LETRAS = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const LETRAS_CIFRADO = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMITONOS_NATURALES = [0, 2, 4, 5, 7, 9, 11];
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const MODOS = {
  mayor: { nombre: 'Mayor', intervalos: [0, 2, 4, 5, 7, 9, 11] },
};

const CALIDADES = {
  '4-7': { nombre: 'mayor', sufijo: '', romano: (r) => r },
  '3-7': { nombre: 'menor', sufijo: 'm', romano: (r) => r.toLowerCase() },
  '3-6': { nombre: 'disminuido', sufijo: '°', romano: (r) => `${r.toLowerCase()}°` },
  '4-8': { nombre: 'aumentado', sufijo: '+', romano: (r) => `${r}+` },
};

function signoDeAlteracion(cantidad) {
  if (cantidad > 0) return '♯'.repeat(cantidad);
  if (cantidad < 0) return '♭'.repeat(-cantidad);
  return '';
}

/**
 * Construye una escala con sus siete acordes.
 * @param {object} opciones
 * @param {string} opciones.tonica      Nombre de la nota sin alteración: 'Do', 'Re', ...
 * @param {number} [opciones.alteracion] +1 sostenido, -1 bemol, 0 natural.
 * @param {string} [opciones.modo]       Por ahora solo 'mayor'.
 * @param {number} [opciones.octava]     Octava de la tónica (Do4 = Do central).
 */
export function construirEscala({ tonica, alteracion = 0, modo = 'mayor', octava = 4 }) {
  const letraTonica = LETRAS.indexOf(tonica);
  if (letraTonica === -1) throw new Error(`Tónica desconocida: ${tonica}`);
  const definicion = MODOS[modo];
  if (!definicion) throw new Error(`Modo desconocido: ${modo}`);

  const alturaTonica = SEMITONOS_NATURALES[letraTonica] + alteracion;

  // Cada grado usa la letra siguiente, y la alteración sale de la diferencia
  // entre la altura que pide el modo y la altura natural de esa letra.
  const notas = definicion.intervalos.map((intervalo, i) => {
    const letra = (letraTonica + i) % 7;
    const altura = alturaTonica + intervalo;
    let alt = (((altura - SEMITONOS_NATURALES[letra]) % 12) + 12) % 12;
    if (alt > 6) alt -= 12;
    const signo = signoDeAlteracion(alt);
    return {
      nombre: LETRAS[letra] + signo,
      cifrado: LETRAS_CIFRADO[letra] + signo,
      altura, // semitonos desde el Do de la octava de la tónica
    };
  });

  const acordes = notas.map((raiz, i) => {
    const tercera = notas[(i + 2) % 7];
    const quinta = notas[(i + 4) % 7];
    const alturaTercera = tercera.altura + (i + 2 >= 7 ? 12 : 0);
    const alturaQuinta = quinta.altura + (i + 4 >= 7 ? 12 : 0);
    const clave = `${alturaTercera - raiz.altura}-${alturaQuinta - raiz.altura}`;
    const calidad = CALIDADES[clave];
    const baseMidi = 12 * (octava + 1);
    return {
      grado: i + 1,
      romano: calidad.romano(ROMANOS[i]),
      nombre: `${raiz.nombre} ${calidad.nombre}`,
      cifrado: raiz.cifrado + calidad.sufijo,
      calidad: calidad.nombre,
      notas: [raiz.nombre, tercera.nombre, quinta.nombre],
      // Listo para cuando la app tenga sonido.
      midi: [raiz.altura, alturaTercera, alturaQuinta].map((a) => baseMidi + a),
    };
  });

  return {
    id: `${(tonica + signoDeAlteracion(alteracion)).toLowerCase()}-${modo}`,
    nombre: `${tonica}${signoDeAlteracion(alteracion)} ${definicion.nombre}`,
    notas: notas.map((n) => n.nombre),
    acordes,
  };
}

/** Escalas disponibles en la aplicación. Para sumar otra, agregala acá. */
export const ESCALAS = {
  'do-mayor': construirEscala({ tonica: 'Do' }),
};

export const ESCALA_INICIAL = 'do-mayor';
