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
"""
import json
import pandas as pd

df = pd.read_csv("data/processed/clusters_municipios_mvp.csv")
destaques = pd.read_csv("data/processed/destaques_completo.csv")
n_destaques_por_uf = destaques.groupby("uf").size()

with open("data/processed/brazil-states-paths.json", encoding="utf-8") as f:
    nomes_estados = {uf: v["name"] for uf, v in json.load(f)["states"].items()}

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
    }

assert len(resumo) == 27, f"esperado 27 estados, veio {len(resumo)}"

with open("data/processed/resumo_estados.json", "w", encoding="utf-8") as f:
    json.dump(resumo, f, ensure_ascii=False, indent=2, sort_keys=True)

print(f"OK - {len(resumo)} estados salvos em data/processed/resumo_estados.json")
