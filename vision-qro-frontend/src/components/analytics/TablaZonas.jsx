import { useMemo, useState } from 'react';
import { formatearCoordenadas, formatearNumero } from './formato.js';

const n0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Tabla de zonas con más reportes: se ordena al pulsar los encabezados y resalta la fila bajo el cursor. */
export default function TablaZonas({ zonas, onVerEnMapa }) {
  // orden: 'n' (más reportes primero, por defecto) | 'pos' (el orden original de la API)
  const [orden, setOrden] = useState({ col: 'n', dir: 'desc' });
  const topZona = zonas.reduce((m, z) => Math.max(m, n0(z.n)), 0);

  const filas = useMemo(() => {
    const conPos = zonas.map((z, i) => ({ ...z, pos: i + 1 }));
    const signo = orden.dir === 'asc' ? 1 : -1;
    return conPos.sort((a, b) => signo * (orden.col === 'pos' ? a.pos - b.pos : n0(a.n) - n0(b.n) || a.pos - b.pos));
  }, [zonas, orden]);

  const alternar = (col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'n' ? 'desc' : 'asc' }));
  const aria = (col) => (orden.col === col ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const flecha = (col) => (orden.col === col ? (orden.dir === 'asc' ? '▲' : '▼') : '');

  return (
    <div className="an-tabla-scroll">
      <table className="an-tabla an-zonas an-tabla--viva">
        <thead>
          <tr>
            <th scope="col" aria-sort={aria('pos')}>
              <button type="button" className="an-orden" onClick={() => alternar('pos')}>N.º <span aria-hidden="true">{flecha('pos')}</span></button>
            </th>
            <th scope="col">Ubicación (latitud, longitud)</th>
            <th scope="col" className="an-der" aria-sort={aria('n')}>
              <button type="button" className="an-orden" onClick={() => alternar('n')}>Reportes <span aria-hidden="true">{flecha('n')}</span></button>
            </th>
            <th scope="col">Frente a la zona con más reportes</th>
            {onVerEnMapa && <th scope="col" className="an-noprint"><span className="sr-only">Acción</span></th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((z, i) => (
            <tr key={`${z.lat},${z.lng}`} style={{ '--i': i }}>
              <td className="num">{z.pos}</td>
              <td className="num">{formatearCoordenadas(z.lat, z.lng)}</td>
              <td className="num an-der">{formatearNumero(z.n)}</td>
              <td>
                <span className="an-barra__pista an-zonas__pista" aria-hidden="true">
                  <span className="an-barra__relleno" style={{ width: topZona > 0 ? `${(n0(z.n) / topZona) * 100}%` : 0 }} />
                </span>
              </td>
              {onVerEnMapa && (
                <td className="an-der an-noprint">
                  <button type="button" className="an-btn an-btn--leve" onClick={() => onVerEnMapa(z.lat, z.lng)}>
                    Ver en el mapa<span className="sr-only">: zona {z.pos}</span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
