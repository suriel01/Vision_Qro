// Funciones puras de formato y resumen para el panel de análisis (sin React).

export const SIN_DATO = '—';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const TZ = 'America/Mexico_City';

const esNum = (v) => typeof v === 'number' && Number.isFinite(v);
const redondear1 = (v) => Math.round((v + Number.EPSILON) * 10) / 10;
const dosDigitos = (n) => String(n).padStart(2, '0');

const NUM = new Intl.NumberFormat('es-MX');
const NUM1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

export function formatearNumero(v) {
  return esNum(v) ? NUM.format(v) : SIN_DATO;
}

export function formatearPorcentaje(v, decimales = 1) {
  if (!esNum(v)) return SIN_DATO;
  const f = decimales === 1 ? NUM1 : new Intl.NumberFormat('es-MX', { maximumFractionDigits: decimales });
  return `${f.format(v)} %`;
}

// Porcentaje n/total con un decimal; null si no se puede calcular.
export function porcentaje(n, total) {
  if (!esNum(n) || !esNum(total) || total <= 0) return null;
  return redondear1((n / total) * 100);
}

// "2 d 7 h" / "5 h" / "45 min"; null si no hay dato.
export function formatearHoras(h) {
  if (!esNum(h) || h < 0) return null;
  if (h < 1) {
    const min = Math.round(h * 60);
    return min >= 60 ? '1 h' : `${min} min`;
  }
  const total = Math.round(h);
  const d = Math.floor(total / 24);
  const resto = total % 24;
  if (d === 0) return `${resto} h`;
  return resto === 0 ? `${d} d` : `${d} d ${resto} h`;
}

export function formatearVariacion(pct, dias) {
  if (!esNum(pct)) return 'Sin periodo anterior para comparar';
  const ref = esNum(dias) && dias > 0 ? `frente a los ${dias} días anteriores` : 'frente al periodo anterior';
  const r = redondear1(Math.abs(pct));
  if (r === 0) return `Sin cambio ${ref}`;
  return `${pct > 0 ? '▲ +' : '▼ −'}${NUM1.format(r)} % ${ref}`;
}

// Media móvil "hacia atrás": los primeros (ventana - 1) puntos no tienen ventana completa y son null.
export function mediaMovil(valores, ventana) {
  if (!Array.isArray(valores)) return [];
  if (!Number.isInteger(ventana) || ventana < 1) return valores.map(() => null);
  return valores.map((_, i) => {
    if (i < ventana - 1) return null;
    let suma = 0;
    for (let k = i - ventana + 1; k <= i; k += 1) suma += esNum(valores[k]) ? valores[k] : 0;
    return suma / ventana;
  });
}

// Marcas de eje con pasos "bonitos" (1, 2, 2.5, 5 x 10^k), siempre enteras y desde 0.
export function ticksBonitos(max, n = 4) {
  if (!esNum(max) || max <= 0) return [0, 1];
  const intervalos = Math.max(1, Math.floor(n));
  const bruto = max / intervalos;
  const base = 10 ** Math.floor(Math.log10(bruto));
  let paso = 1;
  for (const f of [1, 2, 2.5, 5, 10]) {
    const p = f * base;
    if (p >= bruto && Number.isInteger(p)) { paso = p; break; }
  }
  paso = Math.max(1, paso);
  const tope = Math.ceil(max / paso) * paso;
  const ticks = [];
  for (let v = 0; v <= tope; v += paso) ticks.push(v);
  return ticks;
}

function partesFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '');
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { a: Number(m[1]), m: mes, d: Number(m[3]) };
}

// "13 oct"
export function etiquetaFecha(iso) {
  const p = partesFecha(iso);
  return p ? `${p.d} ${MESES[p.m - 1]}` : SIN_DATO;
}

// "13 oct 2026"
export function etiquetaFechaLarga(iso) {
  const p = partesFecha(iso);
  return p ? `${p.d} ${MESES[p.m - 1]} ${p.a}` : SIN_DATO;
}

// "13 oct – 11 nov 2026 · 30 días"
export function textoPeriodo(periodo) {
  const d = partesFecha(periodo?.desde);
  const h = partesFecha(periodo?.hasta);
  if (!d || !h) return '';
  const rango = d.a === h.a
    ? `${etiquetaFecha(periodo.desde)} – ${etiquetaFechaLarga(periodo.hasta)}`
    : `${etiquetaFechaLarga(periodo.desde)} – ${etiquetaFechaLarga(periodo.hasta)}`;
  return esNum(periodo.dias) ? `${rango} · ${periodo.dias} días` : rango;
}

// "10 nov 2026, 22:07" en la zona horaria de Ciudad de México.
export function formatearFechaHora(iso, zona = TZ) {
  const f = new Date(iso);
  if (typeof iso !== 'string' || Number.isNaN(f.getTime())) return SIN_DATO;
  const partes = new Intl.DateTimeFormat('es-MX', {
    timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(f);
  const g = (t) => partes.find((p) => p.type === t)?.value;
  return `${Number(g('day'))} ${MESES[Number(g('month')) - 1]} ${g('year')}, ${g('hour')}:${g('minute')}`;
}

// "20.5934, −100.3921"
export function formatearCoordenadas(lat, lng) {
  if (!esNum(lat) || !esNum(lng)) return SIN_DATO;
  const f = (v) => v.toFixed(4).replace('-', '−');
  return `${f(lat)}, ${f(lng)}`;
}

// Día con más reportes de la serie [{fecha, n}]. Con empate gana el primero. null si no hay reportes.
export function maximoYFecha(serie) {
  if (!Array.isArray(serie)) return null;
  let mejor = null;
  for (const p of serie) {
    if (p && esNum(p.n) && p.n > 0 && (mejor === null || p.n > mejor.n)) mejor = { fecha: p.fecha, n: p.n };
  }
  return mejor;
}

const sumar = (arr) => arr.reduce((a, v) => a + (esNum(v) ? v : 0), 0);

// Frase sobre el día de la semana con más reportes; null si no hay base honesta para decirla.
export function resumenDiaSemana(arr) {
  if (!Array.isArray(arr) || arr.length !== 7) return null;
  const total = sumar(arr);
  if (total < 10) return null;
  const max = Math.max(...arr);
  if (arr.filter((v) => v === max).length > 1) return null; // empate: no hay un día que destaque
  if (max < (total / 7) * 1.25) return null; // reparto casi plano
  const i = arr.indexOf(max);
  return `Los ${DIAS_PLURAL[i]} concentran más reportes (${Math.round((max / total) * 100)} % del total)`;
}

// Índice del día con más reportes cuando resumenDiaSemana tiene algo que decir; si no, null.
export function indiceDiaDestacado(arr) {
  return resumenDiaSemana(arr) === null ? null : arr.indexOf(Math.max(...arr));
}

// Mejor ventana de 3 horas consecutivas: { inicio, suma } o null.
function mejorVentanaHoras(arr) {
  let mejor = null;
  for (let s = 0; s <= 21; s += 1) {
    const suma = sumar(arr.slice(s, s + 3));
    if (mejor === null || suma > mejor.suma) mejor = { inicio: s, suma };
  }
  return mejor;
}

export function resumenHora(arr) {
  if (!Array.isArray(arr) || arr.length !== 24) return null;
  const total = sumar(arr);
  if (total < 10) return null;
  const v = mejorVentanaHoras(arr);
  if (v.suma / total < 0.2) return null; // distribución casi plana (uniforme sería 12.5 %)
  const fin = (v.inicio + 3) % 24;
  return `Entre las ${dosDigitos(v.inicio)}:00 y las ${dosDigitos(fin)}:00 se concentra el ${Math.round((v.suma / total) * 100)} % de los reportes`;
}

// Rango de horas [inicio, inicio + 2] destacado, o null cuando resumenHora es null.
export function ventanaHoraDestacada(arr) {
  return resumenHora(arr) === null ? null : mejorVentanaHoras(arr).inicio;
}
