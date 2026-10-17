import { useFiltros } from "../hooks/useFiltros";
import { VACINA_LABELS, type VacinaKey } from "../types/data";

// Barra de filtro horizontal, so na visao nacional: substitui a coluna
// lateral de 300px (StageIntro) nesse nivel, pra liberar largura pro mapa
// nacional (que precisa dominar a tela — ver pedido de redesign). Em
// estado/municipio o StageIntro continua como estava, sem mudanca.
export function NationalToolbar() {
  const { vacina, setVacina } = useFiltros();

  return (
    <div className="national-toolbar">
      <div className="field-inline">
        <label htmlFor="sel-vacina-nac">Vacina</label>
        <select
          id="sel-vacina-nac"
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
      <a
        className="details-link"
        onClick={() =>
          document.getElementById("table-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      >
        Ver todos os estados em tabela ↓
      </a>
    </div>
  );
}
