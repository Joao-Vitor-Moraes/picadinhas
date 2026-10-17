import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { fmtPct, statusWord, statusText } from "../utils/format";
import type { ResumoEstados } from "../types/data";

// Callout contextual, so na visao nacional (ver CLAUDE.md, Dia 6 Parte 3 /
// redesign, e o pedido de ajuste seguinte): em vez de 4 callouts fixos
// apontando pra 4 estados escolhidos de antemao, um unico card aparece
// quando o usuario passa o mouse sobre um estado no mapa (mesmo gatilho
// que ja alimenta o tooltip existente), com os dados DAQUELE estado —
// cobertura media, tendencia (Dia 4), situacao vs. meta e destaques
// (Dia 5), tudo junto num card so. Sem hover, nenhum card aparece.
//
// O card flutua por cima do mapa (position:absolute, calculado em JS) em
// vez de reservar uma coluna fixa no grid — uma coluna sempre reservada
// (mesmo vazia, sem callout nenhum) foi o que deixava o mapa nacional
// pequeno antes desse ajuste. O lado (esquerda/direita) e a posicao vertical
// sao escolhidos pela posicao do estado no mapa, pra manter a linha-guia
// curta e nao cobrir o proprio estado em destaque.
const BOX_WIDTH = 240;
const GUTTER = 22;

function montarCallout(uf: string, d: ResumoEstados[string]) {
  const sinal = d.tendencia_media >= 0 ? "+" : "";
  const w = statusWord(d.cobertura_media);
  return {
    uf,
    nome: d.nome,
    nMunicipios: d.n_municipios,
    coberturaTexto: fmtPct(d.cobertura_media),
    tendenciaTexto: `${sinal}${d.tendencia_media.toFixed(2).replace(".", ",")} p.p./ano`,
    situacaoTexto: statusText(w),
    situacaoOk: w === "ok" || w === "near",
    quedasBruscas: d.n_destaques,
    riscoAlto: d.n_municipios_risco_alto,
  };
}

interface Geometria {
  side: "left" | "right";
  boxLeft: number;
  boxTop: number;
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
}

export function Callouts({ children }: { children: ReactNode }) {
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const brazilPaths = useAppStore((s) => s.brazilPaths);
  const hoveredUf = useAppStore((s) => s.hoveredUf);
  const stageRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometria | null>(null);

  const ativo = hoveredUf && resumoEstados ? resumoEstados[hoveredUf] : null;
  const callout = ativo && hoveredUf ? montarCallout(hoveredUf, ativo) : null;
  const estadoGeo = hoveredUf && brazilPaths ? brazilPaths.states[hoveredUf] : null;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !brazilPaths || !estadoGeo) {
      setGeo(null);
      return;
    }

    function recompute() {
      const svgEl = stage!.querySelector("svg.map-svg");
      if (!svgEl) return;
      const stageRect = stage!.getBoundingClientRect();
      const svgRect = svgEl.getBoundingClientRect();
      const { width: vbW, height: vbH } = brazilPaths!;
      const scaleBase = Math.min(svgRect.width / vbW, svgRect.height / vbH);
      const offsetX = (svgRect.width - vbW * scaleBase) / 2;
      const offsetY = (svgRect.height - vbH * scaleBase) / 2;

      const x2 = svgRect.left - stageRect.left + offsetX + estadoGeo!.cx * scaleBase;
      const y2 = svgRect.top - stageRect.top + offsetY + estadoGeo!.cy * scaleBase;
      const side: "left" | "right" = x2 < stageRect.width / 2 ? "left" : "right";

      let boxLeft = side === "left" ? x2 - GUTTER - BOX_WIDTH : x2 + GUTTER;
      boxLeft = Math.max(8, Math.min(stageRect.width - BOX_WIDTH - 8, boxLeft));
      const lineX1 = side === "left" ? boxLeft + BOX_WIDTH : boxLeft;

      setGeo({ side, boxLeft, boxTop: y2, lineX1, lineY1: y2, lineX2: x2, lineY2: y2 });
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(stage);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredUf, brazilPaths]);

  if (!resumoEstados || !brazilPaths) return <>{children}</>;

  return (
    <div className="callout-stage" ref={stageRef}>
      <div className="callout-map-slot">{children}</div>
      {geo && callout && (
        <>
          <svg className="callout-lines" aria-hidden="true">
            <g className="callout-line-enter">
              <line x1={geo.lineX1} y1={geo.lineY1} x2={geo.lineX2} y2={geo.lineY2} />
              <circle className="callout-dot" cx={geo.lineX2} cy={geo.lineY2} r={4} />
            </g>
          </svg>
          <div
            className={`callout-box callout-box-${geo.side} callout-box-enter`}
            style={{ left: geo.boxLeft, top: geo.boxTop, width: BOX_WIDTH }}
          >
            <div className="callout-eyebrow">
              {callout.nome} <span className="callout-uf">({callout.uf})</span>
            </div>
            <div className="callout-value display">{callout.coberturaTexto}</div>
            <div className="callout-caption">
              cobertura média 2014–2023 · {callout.nMunicipios.toLocaleString("pt-BR")} municípios
            </div>
            <div className="callout-stats">
              <div className="callout-stat">
                <span>Tendência</span>
                <strong>{callout.tendenciaTexto}</strong>
              </div>
              <div className="callout-stat">
                <span>Situação</span>
                <strong className={callout.situacaoOk ? "ok" : "bad"}>{callout.situacaoTexto}</strong>
              </div>
              <div className="callout-stat">
                <span>Quedas bruscas registradas</span>
                <strong>{callout.quedasBruscas.toLocaleString("pt-BR")} casos</strong>
              </div>
              <div className="callout-stat">
                <span>Risco alto pro próximo ano</span>
                <strong className={callout.riscoAlto > 0 ? "bad" : undefined}>
                  {callout.riscoAlto.toLocaleString("pt-BR")} municípios
                </strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
