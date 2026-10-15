import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";
import { useFiltros } from "../hooks/useFiltros";
import { CLUSTER_LABELS, VACINA_LABELS, type VacinaKey } from "../types/data";
import { Chart } from "./Chart";
import { fmtPct } from "../utils/format";

export function StatRail() {
  const { uf, municipioIbge6, view } = useRota();
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const ufCache = useAppStore((s) => s.ufCache);
  const { vacina, ano } = useFiltros();

  return (
    <div className="stat-rail">
      <SelectionPanel
        view={view}
        uf={uf}
        municipioIbge6={municipioIbge6}
        resumoEstados={resumoEstados}
        ufCache={ufCache}
        vacina={vacina}
        ano={ano}
      />
      <Chart />
    </div>
  );
}

function SelectionPanel({
  view,
  uf,
  municipioIbge6,
  resumoEstados,
  ufCache,
  vacina,
  ano,
}: {
  view: "national" | "state";
  uf: string | null;
  municipioIbge6: string | null;
  resumoEstados: ReturnType<typeof useAppStore.getState>["resumoEstados"];
  ufCache: ReturnType<typeof useAppStore.getState>["ufCache"];
  vacina: VacinaKey;
  ano: string;
}) {
  if (view === "national") {
    if (!uf || !resumoEstados?.[uf]) {
      return (
        <div>
          <div className="stat-block-label">Municípios analisados</div>
          <div className="stat-num num">5.570</div>
          <div className="stat-block" style={{ marginTop: 20 }}>
            <div className="stat-block-label">Período coberto</div>
            <div className="stat-num num" style={{ fontSize: 24 }}>
              2014–23
            </div>
          </div>
          <div className="stat-block" style={{ marginTop: 20 }}>
            <div className="stat-block-label">Quedas atípicas (Dia 5)</div>
            <div className="stat-num num" style={{ color: "var(--crit)", fontSize: 24 }}>
              1.492
            </div>
            <div className="stat-cap">z-score &lt; −2 vs. a média do mesmo ano</div>
          </div>
        </div>
      );
    }
    const estado = resumoEstados[uf];
    return (
      <div>
        <div className="stat-block-label">Estado selecionado</div>
        <div className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {estado.nome}
        </div>
        <div className="stat-cap" style={{ marginBottom: 18 }}>
          {estado.n_municipios} municípios · média 2014–2023
        </div>
        <div className="stat-block">
          <div className="stat-block-label">Cobertura média</div>
          <div className="stat-num num" style={{ fontSize: 26 }}>
            {fmtPct(estado.cobertura_media)}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="stat-block-label">Perfil predominante (Dia 4)</div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            {CLUSTER_LABELS[estado.cluster_predominante] ?? estado.cluster_predominante}
          </div>
        </div>
      </div>
    );
  }

  // view === "state"
  if (!municipioIbge6 || !uf) {
    return <div className="empty-hint">Clique num município no mapa pra ver o detalhe.</div>;
  }
  const ufData = ufCache[uf];
  if (!ufData) return null;
  const meta = ufData.dados.meta_municipios[municipioIbge6];
  if (!meta) {
    return <div className="empty-hint">Município não encontrado. Clique num município no mapa.</div>;
  }
  const rec = ufData.dados.series[municipioIbge6]?.[ano]?.[vacina] ?? null;

  return (
    <div>
      <div className="stat-block-label">Município selecionado</div>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
        {meta.nome}
      </div>
      <div className="stat-cap" style={{ marginBottom: 18 }}>
        {uf} · {ano} · {VACINA_LABELS[vacina]}
      </div>
      <div className="stat-block">
        <div className="stat-block-label">Cobertura</div>
        <div className="stat-num num" style={{ fontSize: 26 }}>
          {fmtPct(rec?.cob ?? null)}
        </div>
      </div>
      {rec && rec.meta !== null && (
        <div style={{ marginTop: 16 }}>
          <div className="stat-block-label">Meta / situação</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="display num" style={{ fontSize: 16, fontWeight: 600 }}>
              {fmtPct(rec.meta)}
            </span>
            <span className={`status-pill ${rec.ok ? "ok" : "bad"}`}>
              {rec.ok ? "atingiu" : "abaixo"}
            </span>
          </div>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <div className="stat-block-label">Perfil (Dia 4)</div>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>
          {CLUSTER_LABELS[meta.cluster] ?? meta.cluster}
        </div>
      </div>
    </div>
  );
}
