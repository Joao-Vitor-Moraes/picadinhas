"""
Dia 6 - Passo 1: resumo agregado por estado (27 linhas), a partir de
data/processed/clusters_municipios_mvp.csv. Alimenta a cor do mapa nacional
(cobertura media, escala continua) + metadados de apoio (cluster
predominante, tendencia media, numero de municipios) exibidos ao selecionar
um estado, sem definir cor.

Dia 6 (redesign) - Passo 1b: n_destaques por estado, contagem de linhas de
data/processed/destaques_completo.csv (quedas atipicas, Dia 5) por uf.
Alimenta o callout editorial "Em destaque" do redesign (estado com maior
concentracao de destaques), sem repetir a logica de deteccao em si.

Atualizacao (branch grafo-comunidades): n_municipios_risco_alto por estado.

Atualizacao (ano-alvo do risco): a faixa de risco NAO vem mais de recalcular
aqui -- vem pronta de data/processed/features_causais_risco_aplicacao.csv (ver
atualizar_features_risco_aplicacao.py), que aplica o modelo ja treinado
(congelado) sobre features causais recalculadas com os anos novos reais. Ou
seja, "risco alto" aqui significa "risco de queda no ano-alvo" (ano seguinte
ao ultimo dado, de-hardcoded no Dia 8), nao mais 2024.
`cobertura_media`/`tendencia_media`/`cluster_predominante` CONTINUAM vindo
de clusters_municipios_mvp.csv (historico 2014-2023, clustering do Dia 4,
nao redefinido) -- so o numero de risco foi atualizado.
"""
import json

import pandas as pd

df = pd.read_csv("data/processed/clusters_municipios_mvp.csv", dtype={"ibge6": str})
risco = pd.read_csv("data/processed/features_causais_risco_aplicacao.csv", dtype={"ibge6": str})
destaques = pd.read_csv("data/processed/destaques_completo.csv")
n_destaques_por_uf = destaques.groupby("uf").size()

with open("data/processed/brazil-states-paths.json", encoding="utf-8") as f:
    nomes_estados = {uf: v["name"] for uf, v in json.load(f)["states"].items()}

df = df.merge(risco[["ibge6", "risco_faixa"]], on="ibge6", how="left")
df["risco_alto"] = df["risco_faixa"] == "alto"

resumo = {}
for uf, grupo in df.groupby("uf"):
    cluster_predominante = grupo["nome_cluster"].mode().iloc[0]
    resumo[uf] = {
        "nome": nomes_estados[uf],
        "n_municipios": int(len(grupo)),
        "cobertura_media": round(float(grupo["media_cobertura"].mean()), 1),
        "tendencia_media": round(float(grupo["tendencia_cobertura"].mean()), 2),
        "cluster_predominante": cluster_predominante,
        "n_destaques": int(n_destaques_por_uf.get(uf, 0)),
        "n_municipios_risco_alto": int(grupo["risco_alto"].sum()),
    }

assert len(resumo) == 27, f"esperado 27 estados, veio {len(resumo)}"

with open("data/processed/resumo_estados.json", "w", encoding="utf-8") as f:
    json.dump(resumo, f, ensure_ascii=False, indent=2, sort_keys=True)

print(f"OK - {len(resumo)} estados salvos em data/processed/resumo_estados.json")
