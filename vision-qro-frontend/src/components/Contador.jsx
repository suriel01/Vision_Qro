// Cifra que cuenta desde 0 hasta su valor al aparecer o cambiar. Respeta "animaciones reducidas" y el ajuste del sistema.
import { useEffect, useState } from 'react';

const reducirMovimiento = () => typeof window !== 'undefined'
  && (document.documentElement.dataset.motion === 'reducida' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** "1,234 reportes" -> { n: 1234, dec: 0, resto: " reportes" }; null si el texto no empieza con un número */
function interpretar(texto) {
  const m = /^(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(String(texto ?? ''));
  if (!m) return null;
  return { n: Number(m[1].replace(/,/g, '')), dec: (m[1].split('.')[1] || '').length, resto: m[2] };
}

export default function Contador({ texto, duracion = 800 }) {
  const info = interpretar(texto);
  const animar = !!info && !reducirMovimiento();
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (!animar) return undefined;
    let cuadro;
    const inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      setValor(info.n * (1 - (1 - t) ** 3)); // desaceleración suave al final
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, animar, duracion]);

  if (!animar) return texto;
  const formato = new Intl.NumberFormat('es-MX', { minimumFractionDigits: info.dec, maximumFractionDigits: info.dec });
  return (
    <>
      <span aria-hidden="true">{formato.format(valor)}{info.resto}</span>
      <span className="sr-only">{texto}</span>
    </>
  );
}
