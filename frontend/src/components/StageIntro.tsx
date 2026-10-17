import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";
import { useFiltros } from "../hooks/useFiltros";
import { VACINA_LABELS, type VacinaKey } from "../types/data";

// So renderizado em estado/municipio (view !== "national") — na visao
// nacional o filtro vira NationalToolbar, uma barra horizontal, pra nao
// reservar os 300px dessa coluna e deixar o mapa nacional dominar a tela
// (ver pedido de redesign).
export function StageIntro() {
  const { uf } = useRota();
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const serieNacional = useAppStore((s) => s.serieNacional);
  const { vacina, ano, setVacina, setAno } = useFiltros();

  const anos = serieNacional?.years ?? [];
  const nMunicipiosEstado = uf && resumoEstados ? resumoEstados[uf]?.n_municipios : null;

  return (
    <div className="stage-col-left">
      <div className="eyebrow">Drill-down por estado</div>
      <div className="stage-title">{(uf && resumoEstados?.[uf]?.nome) || uf}</div>
      <div className="stage-desc">
        {`${nMunicipiosEstado ?? "—"} municípios com malha geográfica e indicadores reais — cores por município no filtro selecionado.`}
      </div>

      <div className="stage-fields">
        <div className="field">
          <label htmlFor="sel-vacina">Vacina</label>
          <select
            id="sel-vacina"
            value={vacina}
            onChange={(e) => setVacina(e.target.value as VacinaKey)}
          >
            {(Object.keys(VACINA_LABELS) as VacinaKey[]).map((key) => (
              <option key={key} value={key}>
                {VACINA_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sel-ano">Ano</label>
          <select id="sel-ano" value={ano} onChange={(e) => setAno(e.target.value)}>
            {anos.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <a
        className="details-link"
        onClick={() =>
          document.getElementById("table-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      >
        Ver todos os municípios em tabela ↓
      </a>
    </div>
  );
}
