import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";
import { useFiltros } from "../hooks/useFiltros";
import { SeloFonte } from "./SeloFonte";
import {
  AVISO_2026_POR_VACINA,
  CORTE_ALTO,
  CORTE_BAIXO,
  CORTE_MEDIO,
  colorFor,
  ehDadoEstimado,
  fmtPct,
} from "../utils/format";

interface TooltipState {
  x: number;
  y: number;
  html: string;
}

const ZOOM_MUNICIPIO_FRACAO = 0.4; // fracao do menor lado do viewport que o municipio deve ocupar
const ZOOM_MUNICIPIO_MAX = 6;

export function MapView() {
  const { uf, municipioIbge6, view } = useRota();
  const brazilPaths = useAppStore((s) => s.brazilPaths);
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const ufCache = useAppStore((s) => s.ufCache);
  const ufLoading = useAppStore((s) => s.ufLoading);
  const ensureUF = useAppStore((s) => s.ensureUF);
  const setHoveredUf = useAppStore((s) => s.setHoveredUf);
  const serieNacional = useAppStore((s) => s.serieNacional);
  const { vacina, ano } = useFiltros();
  const registroAno = serieNacional?.brasil[ano];
  const anoEstimado = ehDadoEstimado(registroAno?.fonte);
  const avisoVacinaMapa =
    vacina !== "todas" && registroAno?.ano_parcial ? AVISO_2026_POR_VACINA[vacina] : undefined;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const muniPathRefs = useRef(new Map<string, SVGPathElement>());

  const ufData = uf ? ufCache[uf] : null;
  const isLoadingUF = uf !== null && ufLoading === uf && !ufData;

  useEffect(() => {
    if (uf) ensureUF(uf);
  }, [uf, ensureUF]);

  // limpa o hover ao sair do mapa (troca de rota/desmonte), pra nao deixar
  // o callout contextual "preso" num estado que nao esta mais sob o cursor
  useEffect(() => () => setHoveredUf(null), [setHoveredUf]);

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // reseta o zoom ao trocar de estado
  useEffect(() => {
    resetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf]);

  // da zoom no municipio selecionado (ou volta ao normal quando a selecao e limpa)
  useEffect(() => {
    if (!municipioIbge6 || !ufData || !viewportRef.current) {
      resetZoom();
      return;
    }
    const pathEl = muniPathRefs.current.get(municipioIbge6);
    const viewport = viewportRef.current;
    if (!pathEl) {
      resetZoom();
      return;
    }

    const bbox = pathEl.getBBox();
    const viewportRect = viewport.getBoundingClientRect();
    const { width: vbW, height: vbH } = ufData.paths;

    // escala svg-user-units -> pixels na identidade (zoom=1, pan=0), considerando
    // o letterboxing do preserveAspectRatio padrao (xMidYMid meet)
    const scaleBase = Math.min(viewportRect.width / vbW, viewportRect.height / vbH);
    const offsetX = (viewportRect.width - vbW * scaleBase) / 2;
    const offsetY = (viewportRect.height - vbH * scaleBase) / 2;

    const cxUser = bbox.x + bbox.width / 2;
    const cyUser = bbox.y + bbox.height / 2;
    const screenX = offsetX + cxUser * scaleBase;
    const screenY = offsetY + cyUser * scaleBase;

    const maiorLadoPx = Math.max(bbox.width, bbox.height) * scaleBase;
    const desiredPx = ZOOM_MUNICIPIO_FRACAO * Math.min(viewportRect.width, viewportRect.height);
    const novoZoom = Math.min(ZOOM_MUNICIPIO_MAX, Math.max(1, maiorLadoPx > 0 ? desiredPx / maiorLadoPx : 1));

    const cx0 = viewportRect.width / 2;
    const cy0 = viewportRect.height / 2;
    const panX = -novoZoom * (screenX - cx0);
    const panY = -novoZoom * (screenY - cy0);

    setZoom(novoZoom);
    setPan({ x: panX, y: panY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipioIbge6, ufData]);

  function showTooltip(evt: React.MouseEvent, html: string) {
    const wrap = viewportRef.current?.getBoundingClientRect();
    if (!wrap) return;
    setTooltip({ x: evt.clientX - wrap.left, y: evt.clientY - wrap.top, html });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (zoom <= 1) return;
    setDragging(true);
    dragMoved.current = false;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const nx = e.clientX - dragStart.current.x;
    const ny = e.clientY - dragStart.current.y;
    if (Math.abs(nx - pan.x) > 3 || Math.abs(ny - pan.y) > 3) dragMoved.current = true;
    setPan({ x: nx, y: ny });
  }
  function onPointerUp() {
    setDragging(false);
  }
  function onViewportClickCapture(e: React.MouseEvent) {
    if (dragMoved.current) {
      e.stopPropagation();
      dragMoved.current = false;
    }
  }

  function irPara(path: string) {
    navigate({ pathname: path, search: searchParams.toString() });
  }

  function zoomIn() {
    setZoom((z) => Math.min(ZOOM_MUNICIPIO_MAX, +(z + 0.5).toFixed(2)));
  }
  function zoomOut() {
    if (municipioIbge6) {
      // sai do zoom no municipio, volta pro estado
      irPara(`/${uf}`);
      return;
    }
    const nz = Math.max(1, +(zoom - 0.5).toFixed(2));
    setZoom(nz);
    if (nz === 1) setPan({ x: 0, y: 0 });
  }

  if (view === "national") {
    if (!brazilPaths || !resumoEstados) return null;

    return (
      <div
        className="map-viewport map-level-enter"
        id="map-viewport"
        ref={viewportRef}
        key="national"
      >
        <div className="map-hint">clique em um estado pra ver os municípios</div>
        <div
          className={`zoom-stage${dragging ? " dragging" : ""}`}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClickCapture={onViewportClickCapture}
        >
          <svg
            className="map-svg active"
            viewBox={`0 0 ${brazilPaths.width} ${brazilPaths.height}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              {Object.entries(brazilPaths.states).map(([ufCode, s]) => {
                const v = resumoEstados[ufCode]?.cobertura_media ?? null;
                return (
                  <path
                    key={ufCode}
                    className={`state-path${uf === ufCode ? " is-selected" : ""}`}
                    d={s.d}
                    style={{ fill: colorFor(v) }}
                    onMouseMove={() => setHoveredUf(ufCode)}
                    onMouseLeave={() => setHoveredUf(null)}
                    onClick={() => irPara(`/${ufCode}`)}
                  />
                );
              })}
            </g>
            <g>
              {Object.entries(brazilPaths.states).map(([ufCode, s]) => (
                <text key={ufCode} className="state-label" x={s.cx} y={s.cy}>
                  {ufCode}
                </text>
              ))}
            </g>
          </svg>
        </div>

        <Tooltip tooltip={tooltip} />
        <Legend />
        <ZoomControls disableOut={zoom <= 1} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </div>
    );
  }

  // view === "state"
  if (isLoadingUF) {
    return (
      <div className="map-viewport" id="map-viewport">
        <div className="empty-hint">Carregando malha e dados do estado…</div>
      </div>
    );
  }
  if (!ufData) return null;

  return (
    <div
      className="map-viewport map-level-enter"
      id="map-viewport"
      ref={viewportRef}
      key={`state:${uf}`}
    >
      <div className="map-hint">
        {municipioIbge6
          ? "clique em − pra voltar ao estado"
          : `${ufData.paths.features.length} municípios · clique para o detalhe`}
        {anoEstimado && <SeloFonte parcial={registroAno?.ano_parcial} avisoVacina={avisoVacinaMapa} />}
      </div>
      <div
        className={`zoom-stage${dragging ? " dragging" : ""}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClickCapture={onViewportClickCapture}
      >
        <svg
          className="map-svg active"
          viewBox={`0 0 ${ufData.paths.width} ${ufData.paths.height}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            {ufData.paths.features.map((f) => {
              const ibge6 = f.id.slice(0, 6);
              const rec = ufData.dados.series[ibge6]?.[ano]?.[vacina] ?? null;
              const v = rec?.cob ?? null;
              return (
                <path
                  key={f.id}
                  ref={(el) => {
                    if (el) muniPathRefs.current.set(ibge6, el);
                    else muniPathRefs.current.delete(ibge6);
                  }}
                  className={`muni-path${municipioIbge6 === ibge6 ? " is-selected" : ""}`}
                  d={f.d}
                  style={{ fill: colorFor(v) }}
                  onMouseMove={(e) =>
                    showTooltip(
                      e,
                      `<b>${f.name}</b><br>${v !== null ? `<span class="tt-val">${fmtPct(v)}</span> de cobertura` : "sem dado"}` +
                        (anoEstimado ? " <i>(estimado)</i>" : ""),
                    )
                  }
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => irPara(`/${uf}/${f.id}`)}
                />
              );
            })}
          </g>
        </svg>
      </div>

      <Tooltip tooltip={tooltip} />
      <Legend />
      <ZoomControls disableOut={zoom <= 1 && !municipioIbge6} onZoomIn={zoomIn} onZoomOut={zoomOut} />
    </div>
  );
}

function Tooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="tooltip show"
      style={{ left: tooltip.x, top: tooltip.y }}
      dangerouslySetInnerHTML={{ __html: tooltip.html }}
    />
  );
}

const LEGEND_BANDS = [
  { cor: "#B91C1C", label: "Crítico", range: `< ${CORTE_BAIXO}%` },
  { cor: "#E8920D", label: "Baixa", range: `${CORTE_BAIXO}–${CORTE_MEDIO}%` },
  { cor: "#52A675", label: "Próxima da meta", range: `${CORTE_MEDIO}–${CORTE_ALTO}%` },
  { cor: "#157347", label: "Na meta", range: `${CORTE_ALTO}%+` },
];

function Legend() {
  return (
    <div className="legend-bar">
      <div className="legend-title">Cobertura</div>
      <div className="legend-chips">
        {LEGEND_BANDS.map((b) => (
          <div className="legend-chip" key={b.label}>
            <span className="legend-dot" style={{ background: b.cor }} />
            <span className="legend-chip-text">
              <span className="legend-chip-label">{b.label}</span>
              <span className="legend-chip-range">{b.range}</span>
            </span>
          </div>
        ))}
        <div className="legend-chip">
          <span className="legend-dot" style={{ background: "var(--nodata)" }} />
          <span className="legend-chip-text">
            <span className="legend-chip-label">Sem dado</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ZoomControls({
  disableOut,
  onZoomIn,
  onZoomOut,
}: {
  disableOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="zoom-controls">
      <button aria-label="Aproximar" onClick={onZoomIn}>
        +
      </button>
      <button aria-label="Afastar / voltar" onClick={onZoomOut} disabled={disableOut}>
        −
      </button>
    </div>
  );
}
