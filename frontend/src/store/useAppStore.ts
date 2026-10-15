import { create } from "zustand";
import type { BrazilStatesPaths, ResumoEstados, SerieNacional, UFData } from "../types/data";

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

  loadBoot: () => Promise<void>;
  ensureUF: (uf: string) => Promise<void>;
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
}));
