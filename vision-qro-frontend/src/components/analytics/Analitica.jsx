import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config.js';
import { BarList, ColumnChart, StackedBar } from './charts.jsx';
import TablaZonas from './TablaZonas.jsx';
import Contador from '../Contador.jsx';
import {
  DIAS_SEMANA, etiquetaFecha, etiquetaFechaLarga, formatearFechaHora, formatearHoras,
  formatearNumero, formatearPorcentaje, formatearVariacion, indiceDiaDestacado, maximoYFecha, mediaMovil,
  porcentaje, resumenDiaSemana, resumenHora, textoPeriodo, ventanaHoraDestacada,
} from './formato.js';
import './analitica.css';

const PERIODOS = [7, 30, 90, 365];
const COLOR_CATEGORIA = {
  bache: 'var(--cat-bache)',
  basura_inorganica: 'var(--cat-inorganica)',
  basura_organica: 'var(--cat-organica)',
  bolsas: 'var(--cat-bolsas)',
  otros: 'var(--cat-otros)',
};
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const n0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function Tarjeta({ titulo, subtitulo, resumen, ancho = 12, children }) {
  const id = useId();
  return (
    <section className={`an-card an-col-${ancho}`} aria-labelledby={id}>
      <h2 className="an-card__titulo" id={id}>{titulo}</h2>
      {subtitulo && <p className="an-card__sub">{subtitulo}</p>}
      {resumen && <p className="an-card__resumen">{resumen}</p>}
      {children}
    </section>
  );
}

function Indicador({ etiqueta, valor, nota }) {
  return (
    <article className="an-card an-col-3 an-kpi">
      <h2 className="an-kpi__et">{etiqueta}</h2>
      <p className="an-kpi__valor num"><Contador texto={valor} /></p>
      <p className="an-kpi__nota">{nota}</p>
    </article>
  );
}

function Cifra({ etiqueta, valor, nota }) {
  return (
    <div className="an-cifra">
      <dt>{etiqueta}</dt>
      <dd className="an-cifra__valor num"><Contador texto={valor} /></dd>
      {nota && <dd className="an-cifra__nota">{nota}</dd>}
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="an-grid an-esqueleto" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <div key={i} className="an-card an-col-3 an-sk an-sk--kpi" />)}
      <div className="an-card an-col-12 an-sk an-sk--grande" />
      <div className="an-card an-col-6 an-sk an-sk--medio" />
      <div className="an-card an-col-6 an-sk an-sk--medio" />
      <div className="an-card an-col-6 an-sk an-sk--medio" />
      <div className="an-card an-col-6 an-sk an-sk--medio" />
    </div>
  );
}

function Informe({ data, onVerEnMapa }) {
  const { resumen, periodo } = data;
  const dias = periodo?.dias ?? 0;
  const enPeriodo = n0(resumen.en_periodo);

  const serie = useMemo(() => data.serie_diaria ?? [], [data.serie_diaria]);
  const datosDia = useMemo(
    () => serie.map((p) => ({ clave: p.fecha, etiqueta: etiquetaFechaLarga(p.fecha), valor: n0(p.n) })),
    [serie],
  );
  const promedio = useMemo(() => (serie.length >= 14 ? mediaMovil(serie.map((p) => n0(p.n)), 7) : null), [serie]);
  const marcasX = useMemo(() => {
    const n = serie.length;
    if (n <= 7) return new Set(serie.map((_, i) => i));
    return new Set(Array.from({ length: 6 }, (_, k) => Math.round((k * (n - 1)) / 5)));
  }, [serie]);
  const maxDia = useMemo(() => maximoYFecha(serie), [serie]);

  const porDia = useMemo(() => (data.por_dia_semana ?? []).map(n0), [data.por_dia_semana]);
  const porHora = useMemo(() => (data.por_hora ?? []).map(n0), [data.por_hora]);
  const datosSemana = useMemo(
    () => porDia.map((v, i) => ({ clave: DIAS_SEMANA[i], etiqueta: DIAS_SEMANA[i], valor: v })),
    [porDia],
  );
  const datosHora = useMemo(
    () => porHora.map((v, i) => ({ clave: `h${i}`, etiqueta: `${String(i).padStart(2, '0')}:00 a ${String(i).padStart(2, '0')}:59`, valor: v })),
    [porHora],
  );
  const inicioHora = ventanaHoraDestacada(porHora);
  const idxDia = indiceDiaDestacado(porDia);

  const categorias = useMemo(() => data.por_categoria ?? [], [data.por_categoria]);
  const totalCat = categorias.reduce((a, c) => a + n0(c.n), 0);
  const itemsCat = useMemo(
    () => categorias.map((c) => ({ clave: c.id, etiqueta: c.etiqueta, valor: n0(c.n), color: COLOR_CATEGORIA[c.id] })),
    [categorias],
  );
  const topCat = categorias.reduce((m, c) => (m === null || n0(c.n) > n0(m.n) ? c : m), null);
  const empateCat = topCat && categorias.filter((c) => n0(c.n) === n0(topCat.n)).length > 1;

  const t = data.baches_por_tamano ?? {};
  const itemsTamano = [
    { clave: 'pequeno', etiqueta: 'Pequeños', valor: n0(t.pequeno), color: 'var(--cat-bache)' },
    { clave: 'mediano', etiqueta: 'Medianos', valor: n0(t.mediano), color: 'var(--cat-bache)' },
    { clave: 'grande', etiqueta: 'Grandes', valor: n0(t.grande), color: 'var(--cat-bache)' },
  ];
  const conTamano = itemsTamano.reduce((a, i) => a + i.valor, 0);
  const totalBaches = conTamano + n0(t.sin_tamano);

  const est = resumen.por_estado ?? {};
  const nuevo = n0(est.nuevo);
  const proceso = n0(est.en_proceso);
  const resuelto = n0(est.resuelto);
  const abiertos = nuevo + proceso;
  const ant = resumen.abiertos_por_antiguedad ?? {};
  const itemsAnt = [
    { clave: '0_7', etiqueta: 'Hasta 7 días', valor: n0(ant['0_7']), tenue: true },
    { clave: '8_30', etiqueta: '8 a 30 días', valor: n0(ant['8_30']), tenue: true },
    { clave: '31_mas', etiqueta: 'Más de 30 días', valor: n0(ant['31_mas']), enfasis: true },
  ];

  const zonas = data.zonas_calientes ?? [];
  const rep = data.repetidos ?? {};
  const cal = data.calidad ?? {};
  const mod = data.modelo;
  const tiempo = formatearHoras(resumen.tiempo_mediano_resolucion_h);

  return (
    <>
      <div className="an-grid">
        <Indicador
          etiqueta="Reportes en el periodo" valor={formatearNumero(enPeriodo)}
          nota={formatearVariacion(resumen.variacion_pct, dias)}
        />
        <Indicador
          etiqueta="Tasa de resolución" valor={formatearPorcentaje(resumen.tasa_resolucion_pct)}
          nota={resumen.total > 0 ? `${formatearNumero(resuelto)} de ${formatearNumero(resumen.total)} reportes resueltos` : 'Aún no hay reportes'}
        />
        <Indicador
          etiqueta="Tiempo mediano de resolución" valor={tiempo ?? '—'}
          nota={tiempo ? 'Mediana: la mitad se resolvió en menos tiempo' : 'Sin reportes resueltos'}
        />
        <Indicador
          etiqueta="Reportes abiertos" valor={formatearNumero(abiertos)}
          nota={`${formatearNumero(nuevo)} nuevos · ${formatearNumero(proceso)} en proceso`}
        />
      </div>

      <div className="an-grid">
        <Tarjeta
          titulo="Reportes por día"
          resumen={maxDia ? `El día con más reportes fue el ${etiquetaFecha(maxDia.fecha)} (${formatearNumero(maxDia.n)})` : 'No hubo reportes en este periodo'}
        >
          <ColumnChart
            datos={datosDia} etiquetaX={(i) => (marcasX.has(i) ? etiquetaFecha(serie[i].fecha) : null)}
            linea={promedio} etiquetaLinea="Promedio de 7 días" alto={240}
            ariaLabel={`Gráfica de columnas con los reportes de cada día, del ${etiquetaFecha(serie[0]?.fecha)} al ${etiquetaFecha(serie[serie.length - 1]?.fecha)}. Total ${formatearNumero(enPeriodo)} reportes.${maxDia ? ` Máximo: ${formatearNumero(maxDia.n)} el ${etiquetaFecha(maxDia.fecha)}.` : ''}`}
            titulo="Reportes por día" columnaEtiqueta="Fecha"
          />
        </Tarjeta>
      </div>

      <div className="an-grid">
        <Tarjeta
          ancho={6} titulo="Por categoría" subtitulo="Reportes del periodo"
          resumen={topCat && !empateCat && n0(topCat.n) > 0 ? `${topCat.etiqueta} es la categoría con más reportes (${formatearPorcentaje(porcentaje(n0(topCat.n), totalCat))})` : null}
        >
          <BarList
            items={itemsCat} total={totalCat}
            ariaLabel={`Reportes por categoría: ${categorias.map((c) => `${c.etiqueta} ${formatearNumero(n0(c.n))}`).join(', ')}`}
          />
        </Tarjeta>
        <Tarjeta
          ancho={6} titulo="Baches por tamaño" subtitulo="Reportes de baches del periodo"
          resumen={conTamano > 0 ? `${formatearPorcentaje(porcentaje(n0(t.grande), conTamano))} de los baches con tamaño indicado son grandes` : null}
        >
          <BarList
            items={itemsTamano} total={conTamano}
            ariaLabel={`Baches por tamaño: pequeños ${itemsTamano[0].valor}, medianos ${itemsTamano[1].valor}, grandes ${itemsTamano[2].valor}`}
          />
          <p className="an-nota">
            Sin tamaño indicado: <span className="num">{formatearNumero(n0(t.sin_tamano))}</span>
            {totalBaches > 0 ? <> de <span className="num">{formatearNumero(totalBaches)}</span> baches</> : null}
          </p>
        </Tarjeta>
      </div>

      <div className="an-grid">
        <Tarjeta
          ancho={6} titulo="Estado de la gestión" subtitulo="Estado actual de todos los reportes, sin importar el periodo"
          resumen={resumen.total > 0 ? `${formatearNumero(abiertos)} de ${formatearNumero(resumen.total)} reportes siguen abiertos` : null}
        >
          <StackedBar
            segmentos={[
              { clave: 'nuevo', etiqueta: 'Nuevos', valor: nuevo, color: 'var(--st-nuevo)' },
              { clave: 'proceso', etiqueta: 'En proceso', valor: proceso, color: 'var(--st-proceso)' },
              { clave: 'resuelto', etiqueta: 'Resueltos', valor: resuelto, color: 'var(--st-resuelto)' },
            ]}
            ariaLabel={`Estado de los reportes: ${nuevo} nuevos, ${proceso} en proceso, ${resuelto} resueltos`}
          />
        </Tarjeta>
        <Tarjeta
          ancho={6} titulo="Antigüedad de los reportes abiertos" subtitulo="Tiempo transcurrido desde que se recibieron"
          resumen={abiertos > 0 ? `${formatearNumero(itemsAnt[2].valor)} reportes abiertos llevan más de 30 días` : 'No hay reportes abiertos'}
        >
          <BarList
            items={itemsAnt} total={abiertos}
            ariaLabel={`Reportes abiertos por antigüedad: hasta 7 días ${itemsAnt[0].valor}, de 8 a 30 días ${itemsAnt[1].valor}, más de 30 días ${itemsAnt[2].valor}`}
          />
        </Tarjeta>
      </div>

      <div className="an-grid">
        <Tarjeta ancho={6} titulo="Día de la semana" resumen={resumenDiaSemana(porDia)}>
          <ColumnChart
            datos={datosSemana} etiquetaX={(i) => DIAS_CORTOS[i]} resaltar={idxDia} valoresVisibles alto={200}
            ariaLabel={`Reportes por día de la semana: ${datosSemana.map((d) => `${d.etiqueta} ${d.valor}`).join(', ')}`}
            titulo="Reportes por día de la semana" columnaEtiqueta="Día"
          />
        </Tarjeta>
        <Tarjeta ancho={6} titulo="Hora del día" subtitulo="Hora local de Ciudad de México" resumen={resumenHora(porHora)}>
          <ColumnChart
            datos={datosHora} etiquetaX={(i) => (i % 3 === 0 ? `${i} h` : null)} valoresVisibles alto={200}
            resaltar={null}
            ariaLabel={`Reportes por hora del día. ${inicioHora !== null ? `Mayor concentración entre las ${inicioHora}:00 y las ${(inicioHora + 3) % 24}:00.` : ''} Total ${porHora.reduce((a, v) => a + v, 0)} reportes.`}
            titulo="Reportes por hora del día" columnaEtiqueta="Hora"
          />
        </Tarjeta>
      </div>

      <div className="an-grid">
        <Tarjeta titulo="Zonas con más reportes" subtitulo="Reportes del periodo">
          {zonas.length === 0 ? (
            <p className="an-vacio">Ninguna zona reúne todavía al menos 3 reportes en este periodo.</p>
          ) : (
            <TablaZonas zonas={zonas} onVerEnMapa={onVerEnMapa} />
          )}
          <p className="an-nota">
            Las zonas son cuadrículas de unos 275 m y solo se muestran las que reúnen al menos 3 reportes, para proteger la privacidad de quien reporta.
          </p>
        </Tarjeta>
      </div>

      <div className="an-grid">
        <Tarjeta titulo="Calidad de los datos" subtitulo="Reportes del periodo">
          <dl className="an-cifras">
            <Cifra etiqueta="Reportes con foto" valor={formatearPorcentaje(cal.con_foto_pct)} />
            <Cifra etiqueta="Pendientes de clasificar" valor={formatearPorcentaje(cal.pendientes_clasificar_pct)} nota="Aún sin categoría definida" />
            <Cifra
              etiqueta="Reportes repetidos" valor={formatearNumero(n0(rep.reportes_repetidos))}
              nota={`${formatearNumero(n0(rep.reportes_repetidos))} de ${formatearNumero(enPeriodo)} reportes están a menos de 30 m de otro`}
            />
          </dl>
        </Tarjeta>
      </div>

      {mod && (
        <div className="an-grid">
          <Tarjeta
            titulo="Clasificador automático" subtitulo="Reportes del periodo"
            resumen="Una persona revisa los resultados; los corregidos alimentan el entrenamiento."
          >
            <dl className="an-cifras an-cifras--4">
              <Cifra etiqueta="Reportes revisados" valor={formatearNumero(mod.revisados)} />
              <Cifra etiqueta="Aceptados sin cambios" valor={formatearPorcentaje(mod.aceptados_pct)} />
              <Cifra etiqueta="Corregidos por una persona" valor={formatearPorcentaje(mod.corregidos_pct)} />
              <Cifra etiqueta="Confianza media" valor={formatearPorcentaje(mod.confianza_media)} />
            </dl>
          </Tarjeta>
        </div>
      )}

      <div className="an-grid">
      <section className="an-card an-col-12 an-metodo" aria-labelledby="an-metodo-t">
        <h2 className="an-card__titulo" id="an-metodo-t">Cómo se calcula</h2>
        <dl className="an-defs">
          <div><dt>Periodo y zona horaria</dt><dd>Los últimos {dias} días, del {etiquetaFechaLarga(periodo?.desde)} al {etiquetaFechaLarga(periodo?.hasta)}. Los días y las horas usan la zona horaria America/Mexico_City. La variación compara con el periodo anterior de la misma duración.</dd></div>
          <div><dt>Reporte abierto</dt><dd>Reporte en estado nuevo o en proceso. La tasa de resolución, el tiempo mediano, el estado de la gestión y la antigüedad son acumulados: no dependen del periodo elegido.</dd></div>
          <div><dt>Mediana</dt><dd>Valor central: la mitad de los reportes se resolvió en menos tiempo y la otra mitad en más. Se ve menos afectada por casos extremos que el promedio.</dd></div>
          <div><dt>Zonas</dt><dd>Cuadrículas de unos 275 m. Solo se muestran las que reúnen al menos 3 reportes (k ≥ 3).</dd></div>
          <div><dt>Repetidos</dt><dd>Reportes a menos de 30 m de otro; se agrupan como un mismo punto.</dd></div>
          <div><dt>Fuente</dt><dd>Reportes ciudadanos recibidos por Telegram.</dd></div>
          <div><dt>Generado</dt><dd>{formatearFechaHora(data.generado_en)}</dd></div>
        </dl>
      </section>
      </div>
    </>
  );
}

export default function Analitica({ token, onVerEnMapa }) {
  const [dias, setDias] = useState(30);
  const [intento, setIntento] = useState(0);
  const [res, setRes] = useState({ clave: null, data: null, error: null });
  const botones = useRef([]);
  const clave = `${dias}|${token || ''}|${intento}`;

  useEffect(() => {
    const ctrl = new AbortController();
    const mia = `${dias}|${token || ''}|${intento}`;
    const headers = token ? { 'X-API-Key': token } : {};
    fetch(`${API_BASE_URL}/api/v1/metricas?dias=${dias}`, { headers, signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setRes({ clave: mia, data, error: null }))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setRes((prev) => ({ clave: mia, data: prev.data, error: e.message || 'Error de red' }));
      });
    return () => ctrl.abort();
  }, [dias, token, intento]);

  const vigente = res.clave === clave;
  const error = vigente ? res.error : null;
  const cargando = !vigente;
  const data = res.data;
  const vacio = data && !error && data.resumen?.total === 0;

  function teclaPeriodo(e, i) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    botones.current[(i + d + PERIODOS.length) % PERIODOS.length]?.focus();
  }

  const periodoTxt = data ? textoPeriodo(data.periodo) : '';

  return (
    <div className="an" aria-busy={cargando}>
      <div className="an-pagina">
        <header className="an-cabecera">
          <div className="an-cabecera__texto">
            <p className="an-print-linea">Vision Qro · Querétaro</p>
            <h1 className="an-h1">Análisis de reportes</h1>
            <p className="an-sub">{periodoTxt || `Últimos ${dias} días`}</p>
            {data && <p className="an-sub num">Generado el {formatearFechaHora(data.generado_en)}</p>}
          </div>
          <div className="an-cabecera__acciones an-noprint">
            <div className="an-segmentado" role="group" aria-label="Periodo del análisis">
              {PERIODOS.map((p, i) => (
                <button
                  key={p} type="button" ref={(el) => { botones.current[i] = el; }}
                  className="an-segmentado__op num" aria-pressed={dias === p}
                  onClick={() => setDias(p)} onKeyDown={(e) => teclaPeriodo(e, i)}
                >
                  {p} días
                </button>
              ))}
            </div>
            <button type="button" className="an-btn" onClick={() => window.print()}>Imprimir o guardar PDF</button>
          </div>
        </header>

        <p className="sr-only" role="status">{cargando ? 'Actualizando datos…' : 'Datos actualizados'}</p>

        {error && (
          <div className="an-aviso" role="alert">
            <p className="an-aviso__titulo">No se pudieron cargar las métricas.</p>
            <p className="an-aviso__texto">Revisa la conexión e inténtalo de nuevo. ({error})</p>
            <button type="button" className="an-btn" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
          </div>
        )}

        {!error && !data && <Esqueleto />}

        {!error && data && (vacio ? (
          <div className="an-aviso an-aviso--vacio">
            <p className="an-aviso__titulo">Aún no hay reportes</p>
            <p className="an-aviso__texto">Cuando la ciudadanía envíe reportes por Telegram, aquí verás su evolución, las zonas con más casos y el avance de la gestión.</p>
          </div>
        ) : (
          <div className={`an-contenido${cargando ? ' an-contenido--viejo' : ''}`}>
            <Informe data={data} onVerEnMapa={onVerEnMapa} />
          </div>
        ))}
      </div>
    </div>
  );
}
