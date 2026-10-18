"""
Gera os JSONs por estado que o frontend consome
(data/processed/municipios/{UF}_municipios.json) -- meta_municipios +
series de cobertura por (municipio, ano, vacina).

Esse script nao existia versionado no repo (os arquivos atuais foram gerados
uma vez no Dia 6 por um script que nao sobrou). Reconstruido aqui a partir
da estrutura observada nos JSONs ja existentes, agora estendido pra cobrir
2014-2026 (antes so ia ate 2023) -- ver CLAUDE.md, extensao pro PNI.

Fontes:
  - clusters_municipios_mvp.csv: roster de municipios (ibge6/uf/nome),
    cluster/media_cobertura/tendencia ("Perfil do municipio", Dia 4 --
    historico 2014-2023, NAO redefinido pelos anos novos).
  - features_causais_risco_2025.csv: risco_probabilidade/risco_faixa,
    ano-alvo ATUALIZADO pra 2026 (modelo congelado, so a feature mudou --
    ver atualizar_features_risco_2025.py).
  - cobertura_mvp_2014_2026.csv: a serie por (ibge6, ano, imunizante), com
    `fonte`/`ano_parcial`/meses_dado_* por ano -- viram campos no proprio
    JSON de saida (por ano, nao por vacina) pro frontend montar o selo de
    proveniencia.
"""
import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PROC = RAIZ / "data" / "processed"

CHAVE_VACINA = {
    "BCG": "bcg",
    "Hepatite B (0 a 30 dias)": "hepb",
    "Pentavalente": "penta",
    "Poliomielite inativada": "polio",
    "Tríplice Viral": "triplice",
}

clusters = pd.read_csv(PROC / "clusters_municipios_mvp.csv", dtype={"ibge6": str})
risco = pd.read_csv(PROC / "features_causais_risco_2025.csv", dtype={"ibge6": str})
mvp = pd.read_csv(PROC / "cobertura_mvp_2014_2026.csv", dtype={"ibge6": str, "imunizante": str}, low_memory=False)

clusters = clusters.merge(risco[["ibge6", "risco_probabilidade", "risco_faixa"]], on="ibge6", how="left")
print(f"Municipios sem risco calculado (ficam sem o campo): {clusters['risco_probabilidade'].isna().sum()}")

# metadados por ano (fonte/ano_parcial/meses_*) -- constante entre municipios, um valor por ano
meta_por_ano = mvp.drop_duplicates("ano").set_index("ano")[
    ["fonte", "ano_parcial", "meses_dado_numerador", "meses_dado_denominador"]
].to_dict(orient="index")
ANOS = sorted(meta_por_ano.keys())

# indice rapido (ibge6, ano) -> {vacina_key: (cob, meta, ok)}, construido em uma passada
serie_idx: dict[tuple[str, int], dict[str, tuple]] = {}
for row in mvp.itertuples(index=False):
    chave_vacina = CHAVE_VACINA.get(row.imunizante)
    if chave_vacina is None:
        continue
    serie_idx.setdefault((row.ibge6, row.ano), {})[chave_vacina] = (
        round(float(row.cobertura_capada), 1),
        round(float(row.meta), 1),
        bool(row.meta_atingida),
    )

metas_municipios_por_uf: dict[str, dict] = {}
series_por_uf: dict[str, dict] = {}

for linha in clusters.itertuples(index=False):
    ibge6, uf = linha.ibge6, linha.uf
    metas_municipios_por_uf.setdefault(uf, {})[ibge6] = {
        "nome": linha.nome_municipio,
        "cluster": linha.nome_cluster,
        "media_cobertura": round(float(linha.media_cobertura), 1),
        "tendencia": round(float(linha.tendencia_cobertura), 1),
        "risco_probabilidade": None if pd.isna(linha.risco_probabilidade) else float(linha.risco_probabilidade),
        "risco_faixa": None if pd.isna(linha.risco_faixa) else linha.risco_faixa,
    }

    series_municipio = {}
    for ano in ANOS:
        vacinas_do_ano = serie_idx.get((ibge6, ano), {})
        cobs_presentes = [v[0] for v in vacinas_do_ano.values()]
        registro_ano = dict(meta_por_ano[ano])  # fonte, ano_parcial, meses_dado_numerador/denominador
        registro_ano["todas"] = {
            "cob": round(sum(cobs_presentes) / len(cobs_presentes), 1) if cobs_presentes else None,
            "meta": 95.0,
            "ok": (sum(cobs_presentes) / len(cobs_presentes) >= 95.0) if cobs_presentes else None,
        }
        for chave_vacina in CHAVE_VACINA.values():
            if chave_vacina in vacinas_do_ano:
                cob, meta, ok = vacinas_do_ano[chave_vacina]
                registro_ano[chave_vacina] = {"cob": cob, "meta": meta, "ok": ok}
            else:
                registro_ano[chave_vacina] = {"cob": None, "meta": None, "ok": None}
        series_municipio[str(ano)] = registro_ano

    series_por_uf.setdefault(uf, {})[ibge6] = series_municipio

pasta_saida = PROC / "municipios"
for uf in sorted(metas_municipios_por_uf):
    saida = {"meta_municipios": metas_municipios_por_uf[uf], "series": series_por_uf[uf]}
    caminho = pasta_saida / f"{uf}_municipios.json"
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)

print(f"\n{len(metas_municipios_por_uf)} arquivos {{UF}}_municipios.json regenerados "
      f"(anos {ANOS[0]}-{ANOS[-1]}) em {pasta_saida}")
