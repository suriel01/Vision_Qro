import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatearNumero, formatearPorcentaje, porcentaje, formatearHoras, formatearVariacion, mediaMovil,
  ticksBonitos, etiquetaFecha, etiquetaFechaLarga, textoPeriodo, formatearFechaHora, formatearCoordenadas,
  maximoYFecha, resumenDiaSemana, resumenHora, indiceDiaDestacado, ventanaHoraDestacada, SIN_DATO,
} from './formato.js';

test('formatearNumero: miles es-MX y valores no numéricos', () => {
  assert.equal(formatearNumero(1234567), '1,234,567');
  assert.equal(formatearNumero(0), '0');
  assert.equal(formatearNumero(null), SIN_DATO);
  assert.equal(formatearNumero(undefined), SIN_DATO);
  assert.equal(formatearNumero(NaN), SIN_DATO);
  assert.equal(formatearNumero('5'), SIN_DATO);
});

test('formatearPorcentaje: un decimal como máximo', () => {
  assert.equal(formatearPorcentaje(96), '96 %');
  assert.equal(formatearPorcentaje(65.2), '65.2 %');
  assert.equal(formatearPorcentaje(12.34), '12.3 %');
  assert.equal(formatearPorcentaje(0), '0 %');
  assert.equal(formatearPorcentaje(null), SIN_DATO);
  assert.equal(formatearPorcentaje(7.26, 0), '7 %');
});

test('porcentaje: redondeo y casos inválidos', () => {
  assert.equal(porcentaje(1, 3), 33.3);
  assert.equal(porcentaje(2, 3), 66.7);
  assert.equal(porcentaje(1, 8), 12.5);
  assert.equal(porcentaje(0, 10), 0);
  assert.equal(porcentaje(10, 10), 100);
  assert.equal(porcentaje(5, 0), null);
  assert.equal(porcentaje(5, -1), null);
  assert.equal(porcentaje(null, 5), null);
  assert.equal(porcentaje(5, NaN), null);
});

test('formatearHoras: min, h, d y d h', () => {
  assert.equal(formatearHoras(55), '2 d 7 h');
  assert.equal(formatearHoras(5), '5 h');
  assert.equal(formatearHoras(0.75), '45 min');
  assert.equal(formatearHoras(0), '0 min');
  assert.equal(formatearHoras(0.999), '1 h');
  assert.equal(formatearHoras(1), '1 h');
  assert.equal(formatearHoras(24), '1 d');
  assert.equal(formatearHoras(23.6), '1 d');
  assert.equal(formatearHoras(48.4), '2 d');
  assert.equal(formatearHoras(25), '1 d 1 h');
  assert.equal(formatearHoras(null), null);
  assert.equal(formatearHoras(-3), null);
  assert.equal(formatearHoras(NaN), null);
});

test('formatearVariacion: subida, bajada, cero y sin dato', () => {
  assert.equal(formatearVariacion(134.9, 30), '▲ +134.9 % frente a los 30 días anteriores');
  assert.equal(formatearVariacion(-12.34, 7), '▼ −12.3 % frente a los 7 días anteriores');
  assert.equal(formatearVariacion(0, 30), 'Sin cambio frente a los 30 días anteriores');
  assert.equal(formatearVariacion(0.04, 30), 'Sin cambio frente a los 30 días anteriores');
  assert.equal(formatearVariacion(1500, 90), '▲ +1,500 % frente a los 90 días anteriores');
  assert.equal(formatearVariacion(null, 30), 'Sin periodo anterior para comparar');
  assert.equal(formatearVariacion(undefined, 30), 'Sin periodo anterior para comparar');
  assert.equal(formatearVariacion(10, undefined), '▲ +10 % frente al periodo anterior');
});

test('mediaMovil: ventana hacia atrás, nulls iniciales y entradas raras', () => {
  assert.deepEqual(mediaMovil([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  assert.deepEqual(mediaMovil([3, 3, 3], 3), [null, null, 3]);
  assert.deepEqual(mediaMovil([5, 7], 1), [5, 7]);
  assert.deepEqual(mediaMovil([1, 2], 5), [null, null]);
  assert.deepEqual(mediaMovil([], 3), []);
  assert.deepEqual(mediaMovil([1, 2], 0), [null, null]);
  assert.deepEqual(mediaMovil([1, 2], 1.5), [null, null]);
  assert.deepEqual(mediaMovil(null, 3), []);
  assert.deepEqual(mediaMovil([0, 0, 0], 2), [null, 0, 0]);
  assert.deepEqual(mediaMovil([2, null, 4], 3), [null, null, 2]);
});

test('ticksBonitos: empiezan en 0, son enteros y cubren el máximo', () => {
  assert.deepEqual(ticksBonitos(14, 4), [0, 5, 10, 15]);
  assert.deepEqual(ticksBonitos(100, 4), [0, 25, 50, 75, 100]);
  assert.deepEqual(ticksBonitos(7, 4), [0, 2, 4, 6, 8]);
  assert.deepEqual(ticksBonitos(1, 4), [0, 1]);
  assert.deepEqual(ticksBonitos(0, 4), [0, 1]);
  assert.deepEqual(ticksBonitos(-5, 4), [0, 1]);
  assert.deepEqual(ticksBonitos(NaN, 4), [0, 1]);
  for (const max of [1, 2, 3, 9, 10, 11, 37, 99, 101, 460, 1234, 99999]) {
    const t = ticksBonitos(max, 4);
    assert.equal(t[0], 0);
    assert.ok(t[t.length - 1] >= max, `cubre ${max}`);
    assert.ok(t.every(Number.isInteger), `enteros para ${max}`);
    assert.ok(t.length <= 7, `no demasiadas marcas para ${max}`);
    const paso = t[1] - t[0];
    assert.ok(t.every((v, i) => v === i * paso), 'pasos uniformes');
  }
});

test('etiquetas de fecha', () => {
  assert.equal(etiquetaFecha('2026-10-13'), '13 oct');
  assert.equal(etiquetaFecha('2026-11-03'), '3 nov');
  assert.equal(etiquetaFecha('2026-01-01T10:00:00Z'), '1 ene');
  assert.equal(etiquetaFecha('2026-13-01'), SIN_DATO);
  assert.equal(etiquetaFecha('basura'), SIN_DATO);
  assert.equal(etiquetaFecha(null), SIN_DATO);
  assert.equal(etiquetaFechaLarga('2026-11-11'), '11 nov 2026');
  assert.equal(etiquetaFechaLarga(undefined), SIN_DATO);
});

test('textoPeriodo: mismo año, años distintos e inválido', () => {
  assert.equal(textoPeriodo({ dias: 30, desde: '2026-10-13', hasta: '2026-11-11' }), '13 oct – 11 nov 2026 · 30 días');
  assert.equal(textoPeriodo({ dias: 90, desde: '2025-12-28', hasta: '2026-01-10' }), '28 dic 2025 – 10 ene 2026 · 90 días');
  assert.equal(textoPeriodo({ desde: '2026-10-13', hasta: '2026-11-11' }), '13 oct – 11 nov 2026');
  assert.equal(textoPeriodo(null), '');
  assert.equal(textoPeriodo({ dias: 7, desde: 'x', hasta: 'y' }), '');
});

test('formatearFechaHora usa la hora de Ciudad de México', () => {
  assert.equal(formatearFechaHora('2026-11-11T04:07:00Z'), '10 nov 2026, 22:07');
  assert.equal(formatearFechaHora('2026-07-01T06:00:00+00:00'), '1 jul 2026, 00:00');
  assert.equal(formatearFechaHora('nada'), SIN_DATO);
  assert.equal(formatearFechaHora(null), SIN_DATO);
});

test('formatearCoordenadas: 4 decimales y signo menos tipográfico', () => {
  assert.equal(formatearCoordenadas(20.5934, -100.3921), '20.5934, −100.3921');
  assert.equal(formatearCoordenadas(20.5, -100), '20.5000, −100.0000');
  assert.equal(formatearCoordenadas(null, 1), SIN_DATO);
  assert.equal(formatearCoordenadas(1, undefined), SIN_DATO);
});

test('maximoYFecha: máximo, empate, ceros y vacío', () => {
  assert.deepEqual(maximoYFecha([{ fecha: 'a', n: 2 }, { fecha: 'b', n: 9 }, { fecha: 'c', n: 4 }]), { fecha: 'b', n: 9 });
  assert.deepEqual(maximoYFecha([{ fecha: 'a', n: 5 }, { fecha: 'b', n: 5 }]), { fecha: 'a', n: 5 });
  assert.equal(maximoYFecha([{ fecha: 'a', n: 0 }, { fecha: 'b', n: 0 }]), null);
  assert.equal(maximoYFecha([]), null);
  assert.equal(maximoYFecha(null), null);
  assert.equal(maximoYFecha([null, { fecha: 'a', n: 'x' }]), null);
});

test('resumenDiaSemana: frase, plurales, empate, plano y pocos datos', () => {
  assert.equal(resumenDiaSemana([5, 5, 5, 22, 5, 5, 5]), 'Los jueves concentran más reportes (42 % del total)');
  assert.equal(resumenDiaSemana([30, 5, 5, 5, 5, 5, 5]), 'Los lunes concentran más reportes (50 % del total)');
  assert.equal(resumenDiaSemana([2, 2, 2, 2, 2, 2, 20]), 'Los domingos concentran más reportes (63 % del total)');
  assert.equal(resumenDiaSemana([2, 2, 2, 2, 2, 20, 2]), 'Los sábados concentran más reportes (63 % del total)');
  assert.equal(resumenDiaSemana([9, 9, 1, 1, 1, 1, 1]), null, 'empate');
  assert.equal(resumenDiaSemana([10, 10, 10, 11, 10, 10, 10]), null, 'plano');
  assert.equal(resumenDiaSemana([3, 1, 1, 1, 1, 1, 1]), null, 'menos de 10 reportes');
  assert.equal(resumenDiaSemana([0, 0, 0, 0, 0, 0, 0]), null);
  assert.equal(resumenDiaSemana([1, 2, 3]), null, 'longitud incorrecta');
  assert.equal(resumenDiaSemana(null), null);
  assert.equal(indiceDiaDestacado([5, 5, 5, 22, 5, 5, 5]), 3);
  assert.equal(indiceDiaDestacado([10, 10, 10, 11, 10, 10, 10]), null);
});

test('resumenHora: ventana de 3 horas, plano y pocos datos', () => {
  const picos = Array(24).fill(1); picos[17] = 10; picos[18] = 20; picos[19] = 10;
  assert.equal(resumenHora(picos), 'Entre las 17:00 y las 20:00 se concentra el 66 % de los reportes');
  const noche = Array(24).fill(0); noche[22] = 5; noche[23] = 5; noche[0] = 5;
  assert.equal(resumenHora(noche), 'Entre las 21:00 y las 00:00 se concentra el 67 % de los reportes');
  assert.equal(resumenHora(Array(24).fill(2)), null, 'plano');
  assert.equal(resumenHora(Array(24).fill(0)), null, 'sin reportes');
  const pocos = Array(24).fill(0); pocos[5] = 4;
  assert.equal(resumenHora(pocos), null, 'menos de 10');
  assert.equal(resumenHora([1, 2, 3]), null);
  assert.equal(resumenHora(undefined), null);
  assert.equal(ventanaHoraDestacada(picos), 17);
  assert.equal(ventanaHoraDestacada(Array(24).fill(2)), null);
});
