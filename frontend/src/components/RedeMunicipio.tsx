import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";

// Paleta categorica (ver skill de dataviz): so os 3 primeiros slots do tema
// padrao validam todos-os-pares (necessario aqui, nao so pares adjacentes,
// porque os nos ficam livres no plano, nao numa sequencia). Cobre 99.9% dos
// casos reais — numa amostra de todos os 5.570 municipios, 96.7% tem no
// maximo 2 comunidades distintas na vizinhanca local e o maximo observado
// foi 4 (em 8 municipios). A 4a comunidade (e alem) cai no cinza "outras".
const PALETA_COMUNIDADE = ["#2a78d6", "#eb6834", "#1baf7a"];
const COR_OUTRAS = "#9c9587";

const W = 220;
const H = 190;
const CX = W / 2;
const CY = 86;
const R_CENTRO = 11;
const R_VIZINHO = 7;
const RAIO_MIN = 48;
const RAIO_MAX = 80;

interface TooltipState {
  x: number;
  y: number;
  texto: string;
}

export function RedeMunicipio() {
  const { municipioIbge6 } = useRota();
  const redeCache = useAppStore((s) => s.redeCache);
  const redeLoading = useAppStore((s) => s.redeLoading);
  const redeError = useAppStore((s) => s.redeError);
  const ensureRede = useAppStore((s) => s.ensureRede);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (municipioIbge6) ensureRede(municipioIbge6);
  }, [municipioIbge6, ensureRede]);

  if (!municipioIbge6) return null;

  const rede = redeCache[municipioIbge6];

  if (!rede) {
    if (redeError) {
      return (
        <div className="rede-municipio">
          <div className="stat-block-label">Municípios parecidos</div>
          <div className="empty-hint">Não foi possível carregar agora ({redeError}).</div>
        </div>
      );
    }
    return (
      <div className="rede-municipio">
        <div className="stat-block-label">Municípios parecidos</div>
        <div className="empty-hint">
          {redeLoading === municipioIbge6 ? "Carregando…" : "—"}
        </div>
      </div>
    );
  }

  const vizinhos = [...rede.vizinhos].sort((a, b) => a.distancia - b.distancia);
  const distancias = rede.arestas.map((a) => a.distancia);
  const distMin = Math.min(...distancias);
  const distMax = Math.max(...distancias);

  // ordem de primeira aparicao das comunidades (centro primeiro) -> slot de cor
  const ordemComunidade = new Map<number, number>();
  for (const no of [rede.municipio, ...vizinhos]) {
    if (no.comunidade !== null && !ordemComunidade.has(no.comunidade)) {
      ordemComunidade.set(no.comunidade, ordemComunidade.size);
    }
  }
  function corDe(comunidade: number | null): string {
    if (comunidade === null) return COR_OUTRAS;
    const slot = ordemComunidade.get(comunidade);
    return slot !== undefined && slot < PALETA_COMUNIDADE.length
      ? PALETA_COMUNIDADE[slot]
      : COR_OUTRAS;
  }

  // layout radial deterministico: vizinho mais parecido no topo, sentido
  // horario; raio da posicao reduz com a distancia (mais parecido = mais
  // perto do centro) — a mesma semantica da aresta, so que no espaco.
  const posicoes = new Map<string, { x: number; y: number }>();
  posicoes.set(rede.municipio.ibge6, { x: CX, y: CY });
  vizinhos.forEach((v, i) => {
    const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / vizinhos.length;
    const t = distMax > distMin ? (v.distancia - distMin) / (distMax - distMin) : 0.5;
    const raio = RAIO_MIN + t * (RAIO_MAX - RAIO_MIN);
    posicoes.set(v.ibge6, { x: CX + raio * Math.cos(angulo), y: CY + raio * Math.sin(angulo) });
  });

  function mostrarTooltip(evt: React.MouseEvent, no: { nome_municipio: string | null; uf: string | null }) {
    const svg = (evt.target as SVGElement).ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      texto: `${no.nome_municipio ?? "?"} (${no.uf ?? "?"})`,
    });
  }

  return (
    <div className="rede-municipio">
      <div className="stat-block-label">Municípios parecidos</div>
      <div className="stat-cap" style={{ marginBottom: 10 }}>
        Os 5 municípios do Brasil cuja cobertura vacinal evoluiu de forma mais
        parecida com a deste ao longo dos anos. A cor mostra o grupo de
        comportamento — mesma cor, padrão parecido.
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          {rede.arestas.map((a) => {
            const p1 = posicoes.get(a.origem);
            const p2 = posicoes.get(a.destino);
            if (!p1 || !p2) return null;
            const t = distMax > distMin ? (a.distancia - distMin) / (distMax - distMin) : 0.5;
            return (
              <line
                key={`${a.origem}-${a.destino}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--ink-faint)"
                strokeWidth={3 - t * 1.8}
                opacity={0.75 - t * 0.4}
              />
            );
          })}
          {vizinhos.map((v) => {
            const p = posicoes.get(v.ibge6)!;
            return (
              <circle
                key={v.ibge6}
                cx={p.x}
                cy={p.y}
                r={R_VIZINHO}
                fill={corDe(v.comunidade)}
                stroke="#fff"
                strokeWidth={2}
                onMouseMove={(e) => mostrarTooltip(e, v)}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
          <circle
            cx={CX}
            cy={CY}
            r={R_CENTRO + 4}
            fill="none"
            stroke={corDe(rede.municipio.comunidade)}
            strokeWidth={1.5}
            strokeDasharray="2 2"
            opacity={0.6}
          />
          <circle
            cx={CX}
            cy={CY}
            r={R_CENTRO}
            fill={corDe(rede.municipio.comunidade)}
            stroke="#fff"
            strokeWidth={2.5}
            onMouseMove={(e) => mostrarTooltip(e, rede.municipio)}
            onMouseLeave={() => setTooltip(null)}
          />
        </svg>
        {tooltip && (
          <div
            className="tooltip show"
            style={{ left: tooltip.x, top: tooltip.y, position: "absolute" }}
          >
            {tooltip.texto}
          </div>
        )}
      </div>
      <ol className="rede-lista">
        {vizinhos.map((v, i) => (
          <li key={v.ibge6}>
            <span className="rede-lista-rank">{i + 1}º</span>
            <span className="rede-lista-swatch" style={{ background: corDe(v.comunidade) }} />
            <span className="rede-lista-nome">
              {v.nome_municipio} <span className="rede-lista-uf">({v.uf})</span>
            </span>
            <span className="rede-lista-grupo">
              {v.comunidade === rede.municipio.comunidade ? "mesmo grupo" : "outro grupo"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
