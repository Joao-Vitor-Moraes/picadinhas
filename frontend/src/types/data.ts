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
// ano_alvo_previsao: o modelo nunca foi retreinado, mas a partir de quando os
// anos 2024/2025 viraram dado real, a previsao passou a apontar pro ano
// seguinte ao ultimo ano cheio disponivel (2026) — ver CLAUDE.md.
export interface RiscoResumo {
  ano_alvo_previsao: number;
  n_total: number;
  n_baixo: number;
  n_medio: number;
  n_alto: number;
}

// Cada ano carrega a vacina "todas" + as 5 do MVP, mais a proveniencia do
// dado daquele ano (constante entre municipios, repetida por ano pra ficar
// junto do dado que ela descreve) — usada pro selo de fonte na UI.
export type AnoRegistroNacional = Record<VacinaKey, number | null> & {
  fonte: "vacinabr" | "pni_reconstruido";
  ano_parcial: boolean;
};

export interface SerieNacional {
  years: number[];
  brasil: Record<string, AnoRegistroNacional>;
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

// Proveniencia por ano (2014-2023 = "vacinabr", 2024-2026 = "pni_reconstruido",
// ver CLAUDE.md) — repetida em cada ano/municipio porque e assim que os dados
// chegam no JSON, mas o valor e o mesmo pra todo mundo num dado ano. 2026 vem
// com ano_parcial=true (so 8 meses) — ver AVISO_2026_POR_VACINA em utils/format.ts
// pras vacinas que saem estruturalmente distorcidas nesse ano.
export interface AnoRegistro {
  fonte: "vacinabr" | "pni_reconstruido";
  ano_parcial: boolean;
  meses_dado_numerador: number;
  meses_dado_denominador: number;
  todas: MunicipioAnoRegistro;
  bcg: MunicipioAnoRegistro;
  hepb: MunicipioAnoRegistro;
  penta: MunicipioAnoRegistro;
  polio: MunicipioAnoRegistro;
  triplice: MunicipioAnoRegistro;
}

export interface UFMunicipiosData {
  meta_municipios: Record<string, MunicipioMeta>;
  series: Record<string, Record<string, AnoRegistro>>;
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
