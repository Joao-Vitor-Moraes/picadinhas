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
  };
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
export interface RedeNo {
  ibge6: string;
  nome_municipio: string | null;
  uf: string | null;
  comunidade: number | null;
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
