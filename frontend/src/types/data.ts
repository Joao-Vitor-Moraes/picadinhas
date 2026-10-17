export type VacinaKey = "todas" | "bcg" | "hepb" | "penta" | "polio" | "triplice";

export const VACINA_LABELS: Record<VacinaKey, string> = {
  todas: "Todas as vacinas",
  bcg: "BCG",
  hepb: "Hepatite B (0 a 30 dias)",
  penta: "Pentavalente",
  polio: "Poliomielite inativada",
  triplice: "Tríplice Viral",
};

export const CLUSTER_LABELS: Record<string, string> = {
  "Cobertura alta e estavel": "Cobertura alta e estável",
  "Cobertura baixa, em recuperacao": "Cobertura baixa, em recuperação",
  "Cobertura em queda e instavel": "Cobertura em queda e instável",
};

export interface BrazilStatesPaths {
  width: number;
  height: number;
  states: Record<
    string,
    { name: string; codigo_ibg: string; d: string; cx: number; cy: number }
  >;
}

export interface ResumoEstados {
  [uf: string]: {
    nome: string;
    n_municipios: number;
    cobertura_media: number;
    tendencia_media: number;
    cluster_predominante: string;
    n_destaques: number;
    n_municipios_risco_alto: number;
  };
}

// Contagem nacional por faixa de risco (ver utils/format.ts, RiscoFaixa) —
// gerado estaticamente por notebooks/gerar_risco_municipios.py, carregado no
// boot junto com resumo_estados/serie_nacional (nao depende do backend).
export interface RiscoResumo {
  n_total: number;
  n_baixo: number;
  n_medio: number;
  n_alto: number;
}

export interface SerieNacional {
  years: number[];
  brasil: Record<string, Record<VacinaKey, number>>;
}

export interface UFMunPaths {
  width: number;
  height: number;
  features: { id: string; name: string; d: string }[];
}

export interface MunicipioMeta {
  nome: string;
  cluster: string;
  media_cobertura: number;
  tendencia: number;
  risco_probabilidade: number;
  risco_faixa: "baixo" | "medio" | "alto";
}

export interface MunicipioAnoRegistro {
  cob: number | null;
  meta: number | null;
  ok: boolean | null;
}

export interface UFMunicipiosData {
  meta_municipios: Record<string, MunicipioMeta>;
  series: Record<string, Record<string, Record<VacinaKey, MunicipioAnoRegistro>>>;
}

export interface UFData {
  paths: UFMunPaths;
  dados: UFMunicipiosData;
}

// Grafo de similaridade + deteccao de comunidades (Louvain), servido pelo
// backend (ver backend/main.py) — expansao de escopo em relacao ao MVP
// original (ver CLAUDE.md, secao Arquitetura).
// Risco de queda atipica no ano seguinte, previsto pelo modelo do backend
// (regressao logistica treinada offline — ver notebooks/notebook04_risco.ipynb
// e backend/main.py, calcular_risco). Ferramenta de priorizacao/triagem, nao
// previsao precisa (AUC-ROC ~0.67 no teste).
export interface RedeRisco {
  probabilidade: number;
  faixa: "baixo" | "medio" | "alto";
}

export interface RedeNo {
  ibge6: string;
  nome_municipio: string | null;
  uf: string | null;
  comunidade: number | null;
  risco: RedeRisco | null;
}

export interface RedeVizinho extends RedeNo {
  distancia: number;
}

export interface RedeAresta {
  origem: string;
  destino: string;
  distancia: number;
}

export interface RedeMunicipio {
  municipio: RedeNo;
  vizinhos: RedeVizinho[];
  arestas: RedeAresta[];
  num_comunidades_total: number;
}
