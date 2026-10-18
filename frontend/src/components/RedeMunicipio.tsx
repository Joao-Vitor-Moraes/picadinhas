import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";
import type { RedeNo } from "../types/data";

// Paleta categorica (ver skill de dataviz): so os 3 primeiros slots do tema
// padrao validam todos-os-pares (necessario aqui, nao so pares adjacentes,
// porque os nos ficam livres no plano, nao numa sequencia). Cobre 99.9% dos
// casos reais — numa amostra de todos os 5.570 municipios, 96.7% tem no
// maximo 2 comunidades distintas na vizinhanca local e o maximo observado
// foi 4 (em 8 municipios). A 4a comunidade (e alem) cai no cinza "outras".
const PALETA_COMUNIDADE = ["#2a78d6", "#eb6834", "#1baf7a"];
const COR_OUTRAS = "#9c9587";

// Risco de queda atipica (modelo do backend): cor segue a paleta de status
// JA reservada no app pra "semaforo" de cobertura (--crit/--low/--good) em
// vez de inventar uma nova — mesma logica de "alto risco = vermelho" usada
// em qualquer outro lugar do Imuniza Brasil. Como a cor dos nos ja esta ocupada
// pela comunidade, o risco usa DUAS codificacoes redundantes (skill de
// dataviz): tamanho do no (magnitude, sequencial) + anel de status (cor),
// nao so uma — assim quem nao distingue bem as cores ainda le o risco pelo
// tamanho.
const COR_RISCO: Record<string, string> = {
  baixo: "#52a675",
  medio: "#e8920d",
  alto: "#b91c1c",
};
const FAIXA_LABEL: Record<string, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

const W = 220;
const H = 190;
const CX = W / 2;
const CY = 86;
const R_CENTRO_MIN = 10;
const R_CENTRO_MAX = 14;
const R_VIZINHO_MIN = 5;
const R_VIZINHO_MAX = 9;
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
  const riscoResumo = useAppStore((s) => s.riscoResumo);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Modo "explorar": deixa clicar num vizinho pra recentralizar o grafo
  // nele, navegando pelo espaco de similaridade sem trocar a pagina/rota
  // principal do app (que continua mostrando o municipio da URL). Modo
  // "estatico" (padrao) e o painel original: centro fixo no municipio da
  // rota atual.
  const [modo, setModo] = useState<"estatico" | "explorar">("estatico");
  const [centroExplorado, setCentroExplorado] = useState<string | null>(null);

  // trocar de municipio pela rota principal (mapa/busca/breadcrumb) sempre
  // reseta a exploracao — senao o painel ficaria "preso" num municipio de
  // uma navegacao anterior.
  useEffect(() => {
    setCentroExplorado(null);
  }, [municipioIbge6]);

  const centroAtivo = modo === "explorar" && centroExplorado ? centroExplorado : municipioIbge6;

  useEffect(() => {
    if (centroAtivo) ensureRede(centroAtivo);
  }, [centroAtivo, ensureRede]);

  if (!municipioIbge6 || !centroAtivo) return null;

  const rede = redeCache[centroAtivo];

  function recentralizar(ibge6: string) {
    if (modo !== "explorar") return;
    setCentroExplorado(ibge6);
  }

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
          {redeLoading === centroAtivo ? "Carregando…" : "—"}
        </div>
      </div>
    );
  }

  const vizinhos = [...rede.vizinhos].sort((a, b) => a.distancia - b.distancia);
  const distancias = rede.arestas.map((a) => a.distancia);
  const distMin = Math.min(...distancias);
  const distMax = Math.max(...distancias);

  // escala de tamanho pelo risco (magnitude, sequencial): relativa aos 6 nos
  // deste painel (centro + 5 vizinhos), nao a escala nacional — o objetivo
  // aqui e destacar QUEM, entre esses 6, tem risco relativamente maior.
  const probabilidades = [rede.municipio, ...vizinhos]
    .map((no) => no.risco?.probabilidade)
    .filter((p): p is number => p !== undefined);
  const probMin = probabilidades.length ? Math.min(...probabilidades) : 0;
  const probMax = probabilidades.length ? Math.max(...probabilidades) : 1;
  function raioPorRisco(risco: RedeNo["risco"], min: number, max: number): number {
    if (!risco) return min;
    const t = probMax > probMin ? (risco.probabilidade - probMin) / (probMax - probMin) : 0.5;
    return min + t * (max - min);
  }

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

  function mostrarTooltip(evt: React.MouseEvent, no: RedeNo) {
    const svg = (evt.target as SVGElement).ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    const textoRisco = no.risco
      ? ` · risco ${FAIXA_LABEL[no.risco.faixa].toLowerCase()} (${Math.round(no.risco.probabilidade * 100)}%)`
      : "";
    setTooltip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      texto: `${no.nome_municipio ?? "?"} (${no.uf ?? "?"})${textoRisco}`,
    });
  }

  const estaExplorando = modo === "explorar" && centroExplorado !== null && centroExplorado !== municipioIbge6;

  return (
    <div className="rede-municipio">
      <div className="stat-block-label">Municípios parecidos</div>
      <div className="rede-modo-toggle" role="group" aria-label="Modo do grafo">
        <button
          type="button"
          className={modo === "estatico" ? "ativo" : ""}
          onClick={() => {
            setModo("estatico");
            setCentroExplorado(null);
          }}
        >
          Estático
        </button>
        <button
          type="button"
          className={modo === "explorar" ? "ativo" : ""}
          onClick={() => setModo("explorar")}
        >
          Explorar
        </button>
      </div>
      <div className="stat-cap" style={{ marginBottom: 10 }}>
        {modo === "estatico" ? (
          <>
            Os 5 municípios do Brasil cuja cobertura vacinal evoluiu de forma mais
            parecida com a deste ao longo dos anos. A cor mostra o grupo de
            comportamento; o tamanho e o anel mostram o risco previsto de queda
            brusca em {riscoResumo?.ano_alvo_previsao ?? "breve"} (estimativa com base no
            histórico até o último ano completo disponível).
          </>
        ) : (
          <>Clique em um município vizinho pra ver os municípios parecidos com ele e continuar explorando.</>
        )}
      </div>
      {estaExplorando && (
        <button type="button" className="rede-voltar" onClick={() => setCentroExplorado(null)}>
          ← voltar para {redeCache[municipioIbge6]?.municipio.nome_municipio ?? "município atual"}
        </button>
      )}
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} key={centroAtivo} className="rede-svg-recentro">
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
            const r = raioPorRisco(v.risco, R_VIZINHO_MIN, R_VIZINHO_MAX);
            const clicavel = modo === "explorar";
            return (
              <g key={v.ibge6}>
                {v.risco && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 3}
                    fill="none"
                    stroke={COR_RISCO[v.risco.faixa]}
                    strokeWidth={1.8}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={corDe(v.comunidade)}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ cursor: clicavel ? "pointer" : "default" }}
                  onMouseMove={(e) => mostrarTooltip(e, v)}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => recentralizar(v.ibge6)}
                />
              </g>
            );
          })}
          {rede.municipio.risco && (
            <circle
              cx={CX}
              cy={CY}
              r={raioPorRisco(rede.municipio.risco, R_CENTRO_MIN, R_CENTRO_MAX) + 4}
              fill="none"
              stroke={COR_RISCO[rede.municipio.risco.faixa]}
              strokeWidth={2}
            />
          )}
          <circle
            cx={CX}
            cy={CY}
            r={raioPorRisco(rede.municipio.risco, R_CENTRO_MIN, R_CENTRO_MAX)}
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
          <li
            key={v.ibge6}
            className={modo === "explorar" ? "clicavel" : ""}
            onClick={() => recentralizar(v.ibge6)}
          >
            <span className="rede-lista-rank">{i + 1}º</span>
            <span className="rede-lista-swatch" style={{ background: corDe(v.comunidade) }} />
            <span className="rede-lista-nome">
              {v.nome_municipio} <span className="rede-lista-uf">({v.uf})</span>
            </span>
            {v.risco && (
              <span className="rede-lista-risco" style={{ color: COR_RISCO[v.risco.faixa] }}>
                risco {FAIXA_LABEL[v.risco.faixa].toLowerCase()}
              </span>
            )}
            <span className="rede-lista-grupo">
              {v.comunidade === rede.municipio.comunidade ? "mesmo grupo" : "outro grupo"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
