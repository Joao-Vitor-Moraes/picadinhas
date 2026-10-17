import { create } from "zustand";
import { API_BASE_URL } from "../config";
import type {
  BrazilStatesPaths,
  RedeMunicipio,
  ResumoEstados,
  SerieNacional,
  UFData,
} from "../types/data";

interface AppState {
  // dados carregados no boot (pequenos, sempre na memoria)
  brazilPaths: BrazilStatesPaths | null;
  resumoEstados: ResumoEstados | null;
  serieNacional: SerieNacional | null;
  bootError: string | null;
  bootLoading: boolean;

  // dados por estado, buscados sob demanda e cacheados
  // (qual estado/municipio esta selecionado vive na URL, nao aqui)
  ufCache: Record<string, UFData>;
  ufLoading: string | null;
  ufError: string | null;

  // estado de UI efemero: estado sob o cursor no mapa nacional (nao vem da
  // URL, ao contrario da selecao/drill-down) — alimenta o callout
  // contextual do redesign (ver Callouts.tsx)
  hoveredUf: string | null;
  setHoveredUf: (uf: string | null) => void;

  // rede de similaridade + comunidade (Louvain) por municipio, buscada do
  // backend sob demanda e cacheada em memoria (mesmo padrao de ufCache)
  redeCache: Record<string, RedeMunicipio>;
  redeLoading: string | null;
  redeError: string | null;

  loadBoot: () => Promise<void>;
  ensureUF: (uf: string) => Promise<void>;
  ensureRede: (ibge6: string) => Promise<void>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const useAppStore = create<AppState>((set, get) => ({
  brazilPaths: null,
  resumoEstados: null,
  serieNacional: null,
  bootError: null,
  bootLoading: false,

  ufCache: {},
  ufLoading: null,
  ufError: null,

  hoveredUf: null,
  setHoveredUf: (uf) => set({ hoveredUf: uf }),

  redeCache: {},
  redeLoading: null,
  redeError: null,

  async loadBoot() {
    set({ bootLoading: true, bootError: null });
    try {
      const [brazilPaths, resumoEstados, serieNacional] = await Promise.all([
        fetchJson<BrazilStatesPaths>("/data/brazil-states-paths.json"),
        fetchJson<ResumoEstados>("/data/resumo_estados.json"),
        fetchJson<SerieNacional>("/data/serie_nacional.json"),
      ]);
      set({ brazilPaths, resumoEstados, serieNacional, bootLoading: false });
    } catch (err) {
      set({
        bootError: err instanceof Error ? err.message : String(err),
        bootLoading: false,
      });
    }
  },

  async ensureUF(uf) {
    if (get().ufCache[uf] || get().ufLoading === uf) return;

    set({ ufLoading: uf, ufError: null });
    try {
      const [paths, dados] = await Promise.all([
        fetchJson(`/data/municipios/${uf}-mun-paths.json`),
        fetchJson(`/data/municipios/${uf}_municipios.json`),
      ]);
      set((state) => ({
        ufCache: { ...state.ufCache, [uf]: { paths, dados } as UFData },
        ufLoading: state.ufLoading === uf ? null : state.ufLoading,
      }));
    } catch (err) {
      set({
        ufError: err instanceof Error ? err.message : String(err),
        ufLoading: null,
      });
    }
  },

  async ensureRede(ibge6) {
    if (get().redeCache[ibge6] || get().redeLoading === ibge6) return;

    set({ redeLoading: ibge6, redeError: null });
    try {
      const rede = await fetchJson<RedeMunicipio>(`${API_BASE_URL}/municipios/${ibge6}/rede`);
      set((state) => ({
        redeCache: { ...state.redeCache, [ibge6]: rede },
        redeLoading: state.redeLoading === ibge6 ? null : state.redeLoading,
      }));
    } catch (err) {
      set({
        redeError: err instanceof Error ? err.message : String(err),
        redeLoading: null,
      });
    }
  },
}));
