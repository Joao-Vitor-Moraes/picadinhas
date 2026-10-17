import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";
import { useFiltros } from "../hooks/useFiltros";
import { fmtPct, riscoCor, riscoTexto, statusText, statusWord } from "../utils/format";
import type { RiscoFaixa } from "../utils/format";

export function RankingTable() {
  const { uf, municipioIbge6, view } = useRota();
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const ufCache = useAppStore((s) => s.ufCache);
  const { vacina, ano } = useFiltros();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");

  const isNational = view === "national";

  const rows = useMemo(() => {
    if (isNational) {
      if (!resumoEstados) return [];
      return Object.entries(resumoEstados)
        .map(([ufCode, info]) => ({
          key: ufCode,
          rota: ufCode,
          name: info.nome,
          code: ufCode,
          n: info.n_municipios,
          v: info.cobertura_media as number | null,
          risco: null as RiscoFaixa | null,
        }))
        .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
    }
    if (!uf || !ufCache[uf]) return [];
    const ufData = ufCache[uf];
    const ibge7PorIbge6: Record<string, string> = {};
    for (const f of ufData.paths.features) ibge7PorIbge6[f.id.slice(0, 6)] = f.id;
    return Object.entries(ufData.dados.meta_municipios)
      .map(([ibge6, meta]) => {
        const v = ufData.dados.series[ibge6]?.[ano]?.[vacina]?.cob ?? null;
        return {
          key: ibge6,
          rota: ibge7PorIbge6[ibge6] ?? ibge6,
          name: meta.nome,
          code: ibge6,
          n: 1,
          v,
          risco: meta.risco_faixa,
        };
      })
      .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  }, [isNational, resumoEstados, uf, ufCache, ano, vacina]);

  const filtered = rows.filter(
    (r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.code.toLowerCase().includes(query.toLowerCase()),
  );

  function onRowClick(rota: string) {
    const search = searchParams.toString();
    const path = isNational ? `/${rota}` : `/${uf}/${rota}`;
    navigate({ pathname: path, search });
    document.getElementById("map-viewport")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="table-section" id="table-section">
      <div className="table-head-row">
        <div>
          <h2>{isNational ? "Todos os estados" : "Todos os municípios"}</h2>
          <p>
            {isNational ? "Cobertura média 2014–2023" : `Cobertura em ${ano}`} · clique numa linha pra ver no mapa
          </p>
        </div>
        <div className="search-box">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "var(--ink-faint)", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder={isNational ? "Buscar estado…" : "Buscar município…"}
          />
        </div>
      </div>
      <table className="ranking">
        <thead>
          <tr>
            <th>{isNational ? "Estado" : "Município"}</th>
            {isNational && <th className="num-col">Municípios</th>}
            <th className="num-col">Cobertura</th>
            <th>Situação</th>
            {!isNational && <th title="Risco de queda brusca no próximo ano, estimado com base no histórico até 2023">Risco</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const w = statusWord(r.v);
            const selected = isNational ? uf === r.key : municipioIbge6 === r.key;
            return (
              <tr
                key={r.key}
                className={selected ? "is-selected" : ""}
                onClick={() => onRowClick(r.rota)}
              >
                <td>
                  <span className="uf-badge">
                    <span className="uf-name">{r.name}</span>
                    {isNational && <span className="uf-code">{r.code}</span>}
                  </span>
                </td>
                {isNational && <td className="num-col num">{r.n.toLocaleString("pt-BR")}</td>}
                <td className="num-col num">{fmtPct(r.v)}</td>
                <td>{w ? <span className={`row-status ${w}`}>{statusText(w)}</span> : "—"}</td>
                {!isNational && (
                  <td>
                    <span style={{ color: riscoCor(r.risco), fontWeight: 600, fontSize: 12 }}>
                      {riscoTexto(r.risco)}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
