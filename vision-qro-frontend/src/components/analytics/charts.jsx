// Gráficas mínimas hechas a mano (SVG/HTML + CSS). Sin dependencias.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatearNumero, formatearPorcentaje, porcentaje, ticksBonitos } from './formato.js';

function useAncho(ref, inicial = 640) {
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w > 0) setAncho(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return ancho;
}

function TablaDatos({ titulo, columnaEtiqueta, columnaValor, filas }) {
  return (
    <details className="an-datos">
      <summary>Ver datos en tabla</summary>
      <div className="an-datos__scroll">
        <table className="an-tabla">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">{columnaEtiqueta}</th>
              <th scope="col" className="an-der">{columnaValor}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave}>
                <th scope="row">{f.etiqueta}</th>
                <td className="num an-der">{formatearNumero(f.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const M = { izq: 40, der: 14, arriba: 18, abajo: 26 };

/**
 * Columnas con eje Y desde 0.
 * datos: [{ clave, etiqueta, valor }]; etiquetaX(i) -> texto o null; linea: serie opcional (con nulls);
 * resaltar: índice con énfasis (el resto se atenúa) o null.
 */
export const ColumnChart = memo(function ColumnChart({
  datos, etiquetaX, linea = null, etiquetaLinea = '', resaltar = null, valoresVisibles = false,
  alto = 220, ariaLabel, titulo, columnaEtiqueta = 'Categoría', columnaValor = 'Reportes',
}) {
  const ref = useRef(null);
  const ancho = useAncho(ref);

  const g = useMemo(() => {
    const n = datos.length;
    const valores = datos.map((d) => d.valor);
    const max = Math.max(0, ...valores, ...(linea || []).filter((v) => v !== null));
    const ticks = ticksBonitos(max, 4);
    const tope = ticks[ticks.length - 1];
    const plotW = Math.max(10, ancho - M.izq - M.der);
    const plotH = alto - M.arriba - M.abajo;
    const banda = plotW / Math.max(1, n);
    const y = (v) => M.arriba + plotH * (1 - v / tope);
    const digitos = String(Math.max(0, ...valores)).length;
    const barW = Math.max(1, Math.min(banda * 0.72, 34));
    return { n, ticks, plotW, plotH, banda, y, barW, mostrarValores: valoresVisibles && banda >= 7 * digitos + 6 };
  }, [datos, linea, ancho, alto, valoresVisibles]);

  const cx = (i) => M.izq + g.banda * (i + 0.5);
  const puntosLinea = linea
    ? linea.map((v, i) => (v === null ? null : [cx(i), g.y(v)])).filter(Boolean)
    : [];
  const ruta = puntosLinea.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  return (
    <div className="an-grafica" ref={ref}>
      {ruta && etiquetaLinea && (
        <p className="an-leyenda"><span className="an-leyenda__linea" aria-hidden="true" />{etiquetaLinea}</p>
      )}
      <svg
        className="an-svg" role="img" aria-label={ariaLabel}
        width="100%" viewBox={`0 0 ${ancho} ${alto}`} style={{ height: 'auto', aspectRatio: `${ancho} / ${alto}` }}
      >
        {g.ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'an-eje' : 'an-rejilla'} x1={M.izq} x2={M.izq + g.plotW} y1={g.y(t)} y2={g.y(t)} />
            <text className="an-texto an-texto--y num" x={M.izq - 6} y={g.y(t)} dy="0.32em" textAnchor="end">
              {formatearNumero(t)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => {
          const h = g.plotH * (d.valor / g.ticks[g.ticks.length - 1]);
          const destacada = resaltar === i;
          const tenue = resaltar !== null && !destacada;
          const x = cx(i) - g.barW / 2;
          const etiqueta = etiquetaX(i);
          return (
            <g key={d.clave}>
              <rect
                className={`an-columna${tenue ? ' an-columna--tenue' : ''}`}
                x={x} y={g.y(d.valor)} width={g.barW} height={Math.max(0, h)} rx={g.barW >= 6 ? 2 : 0}
              >
                <title>{`${d.etiqueta}: ${formatearNumero(d.valor)}`}</title>
              </rect>
              {(g.mostrarValores || destacada) && d.valor > 0 && (
                <text className={`an-texto num${destacada ? ' an-texto--fuerte' : ''}`} x={cx(i)} y={g.y(d.valor) - 5} textAnchor="middle">
                  {formatearNumero(d.valor)}
                </text>
              )}
              {etiqueta && (
                <text
                  className="an-texto num" y={alto - 7}
                  x={cx(i) < M.izq + 20 ? M.izq : cx(i) > ancho - 24 ? ancho - M.der : cx(i)}
                  textAnchor={cx(i) < M.izq + 20 ? 'start' : cx(i) > ancho - 24 ? 'end' : 'middle'}
                >
                  {etiqueta}
                </text>
              )}
            </g>
          );
        })}
        {ruta && (
          <g>
            <path className="an-linea" d={ruta} />
          </g>
        )}
      </svg>
      <TablaDatos titulo={titulo} columnaEtiqueta={columnaEtiqueta} columnaValor={columnaValor} filas={datos} />
    </div>
  );
});

/**
 * Lista de barras horizontales con etiqueta y valor como texto real (sirve también de alternativa accesible).
 * items: [{ clave, etiqueta, valor, color, tenue }]; total: base del porcentaje (opcional).
 */
export const BarList = memo(function BarList({ items, total = null, ariaLabel }) {
  const max = Math.max(0, ...items.map((i) => i.valor));
  return (
    <ul className="an-barras" aria-label={ariaLabel}>
      {items.map((it) => {
        const pct = total === null ? null : porcentaje(it.valor, total);
        return (
          <li key={it.clave} className={`an-barra${it.tenue ? ' an-barra--tenue' : ''}${it.enfasis ? ' an-barra--enfasis' : ''}`}>
            <span className="an-barra__et">{it.etiqueta}</span>
            <span className="an-barra__val num">
              {formatearNumero(it.valor)}
              {pct !== null && <span className="an-barra__pct"> · {formatearPorcentaje(pct)}</span>}
            </span>
            <span className="an-barra__pista" aria-hidden="true">
              <span
                className="an-barra__relleno"
                style={{ width: max > 0 ? `${(it.valor / max) * 100}%` : '0%', background: it.color || 'var(--an-serie)' }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
});

/** Barra única al 100 % dividida en segmentos, con lista de etiquetas, cifras y porcentajes. */
export const StackedBar = memo(function StackedBar({ segmentos, ariaLabel }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  return (
    <div className="an-apilada">
      <div className="an-apilada__barra" role="img" aria-label={ariaLabel}>
        {segmentos.map((s) => (
          <span key={s.clave} className="an-apilada__seg" style={{ flexGrow: s.valor, background: s.color }} />
        ))}
      </div>
      <ul className="an-apilada__lista">
        {segmentos.map((s) => (
          <li key={s.clave}>
            <span className="an-apilada__muestra" aria-hidden="true" style={{ background: s.color }} />
            <span className="an-apilada__et">{s.etiqueta}</span>
            <span className="an-apilada__val num">
              {formatearNumero(s.valor)} <span className="an-barra__pct">· {formatearPorcentaje(porcentaje(s.valor, total))}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
