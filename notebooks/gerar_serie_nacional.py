"""
Dia 6 - Passo 1b: serie nacional por ano/vacina, pro grafico "evolucao
nacional" que fica visivel em toda vista do app (nacional e estado).
Mesma metodologia do Dia 3 Parte 4 (media de cobertura_capada por ano,
ignorando NaN) e do Dia 4 Parte 1 ("todas" = media entre as 5 vacinas,
ignorando NaN), so que agregada em nivel nacional em vez de por municipio.
"""
import json
import pandas as pd

CHAVE_VACINA = {
    "BCG": "bcg",
    "Hepatite B (0 a 30 dias)": "hepb",
    "Pentavalente": "penta",
    "Poliomielite inativada": "polio",
    "Tríplice Viral": "triplice",
}

df = pd.read_csv(
    "data/processed/serie_temporal_mvp.csv",
    dtype={"ibge6": str, "uf": str, "imunizante": str},
)

media_ano_vacina = df.groupby(["ano", "imunizante"])["cobertura_capada"].mean()
media_ano_todas = df.groupby("ano")["cobertura_capada"].mean()

anos = list(range(2014, 2024))
brasil = {}
for ano in anos:
    linha = {"todas": round(float(media_ano_todas.loc[ano]), 1)}
    for nome_vacina, chave in CHAVE_VACINA.items():
        linha[chave] = round(float(media_ano_vacina.loc[(ano, nome_vacina)]), 1)
    brasil[str(ano)] = linha

saida = {"years": anos, "brasil": brasil}

with open("data/processed/serie_nacional.json", "w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=2)

print("OK - data/processed/serie_nacional.json")
