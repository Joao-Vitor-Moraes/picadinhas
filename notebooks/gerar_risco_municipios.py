"""
Extensao do modelo de risco (notebook04_risco.ipynb, branch grafo-comunidades)
pra alimentar a UI principal do app, nao so o endpoint do backend.

O risco de queda atipica em 2024 e estatico entre deploys (vem do snapshot
2014-2023 inteiro, ver notebook04 Etapa F) -- por isso, em vez de a UI
principal depender do backend estar de pe so pra mostrar um numero que nao
muda, esse script aplica o mesmo modelo (data/processed/modelo_risco.json)
e grava o resultado direto nos arquivos estaticos que o frontend ja consome:

  - data/processed/municipios/{UF}_municipios.json: cada municipio em
    meta_municipios ganha risco_probabilidade + risco_faixa.
  - data/processed/risco_resumo.json (novo): contagem nacional por faixa,
    pro painel nacional (visao sem estado selecionado).

O calculo em si (produto escalar + sigmoide sobre as mesmas 6 features
padronizadas) e o mesmo que backend/main.py (calcular_risco) aplica pro
grafo exploravel -- aqui so roda uma vez, offline, pra gerar arquivo
estatico em vez de servir por API.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PROC = RAIZ / "data" / "processed"

clusters = pd.read_csv(PROC / "clusters_municipios_mvp.csv", dtype={"ibge6": str})
with open(PROC / "modelo_risco.json", encoding="utf-8") as f:
    modelo = json.load(f)

media = np.array(modelo["scaler_mean"])
desvio = np.array(modelo["scaler_std"])
coef = modelo["coeficientes"]
cortes = modelo["cortes_risco"]

cont = clusters[
    ["media_cobertura", "variabilidade_cobertura", "tendencia_cobertura", "isolamento_similaridade"]
].values
cont_padr = (cont - media) / desvio

z = coef["intercepto"]
for i, nome in enumerate(modelo["features_continuas"]):
    z += coef[nome] * cont_padr[:, i]
z += coef["cluster_baixa_recuperacao"] * clusters["nome_cluster"].str.contains("recuperacao").astype(float)
z += coef["cluster_queda_instavel"] * clusters["nome_cluster"].str.contains("instavel").astype(float)

probabilidade = 1 / (1 + np.exp(-z))
faixa = np.where(
    probabilidade >= cortes["alto"], "alto",
    np.where(probabilidade >= cortes["medio"], "medio", "baixo"),
)

clusters["risco_probabilidade"] = probabilidade.round(4)
clusters["risco_faixa"] = faixa
risco_por_ibge6 = clusters.set_index("ibge6")[["risco_probabilidade", "risco_faixa"]].to_dict(orient="index")

print("Distribuicao nacional por faixa:")
print(clusters["risco_faixa"].value_counts())

# Passo 1: mergear em cada {UF}_municipios.json existente (meta_municipios)
pasta_municipios = PROC / "municipios"
arquivos_atualizados = 0
municipios_sem_match = 0
for caminho in sorted(pasta_municipios.glob("*_municipios.json")):
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)

    for ibge6, meta in dados["meta_municipios"].items():
        info = risco_por_ibge6.get(ibge6)
        if info is None:
            municipios_sem_match += 1
            continue
        meta["risco_probabilidade"] = info["risco_probabilidade"]
        meta["risco_faixa"] = info["risco_faixa"]

    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    arquivos_atualizados += 1

print(f"\n{arquivos_atualizados} arquivos de municipios atualizados com risco.")
print(f"Municipios sem risco calculado (fora do modelo): {municipios_sem_match}")

# Passo 2: resumo nacional por faixa, pro painel nacional (sem estado selecionado)
resumo = {
    "n_total": int(len(clusters)),
    "n_baixo": int((clusters["risco_faixa"] == "baixo").sum()),
    "n_medio": int((clusters["risco_faixa"] == "medio").sum()),
    "n_alto": int((clusters["risco_faixa"] == "alto").sum()),
}
with open(PROC / "risco_resumo.json", "w", encoding="utf-8") as f:
    json.dump(resumo, f, ensure_ascii=False, indent=2)

print(f"\nResumo nacional salvo em data/processed/risco_resumo.json: {resumo}")
