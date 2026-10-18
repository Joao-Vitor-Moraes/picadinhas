"""
Dia 6 - Passo 1b: serie nacional por ano/vacina, pro grafico "evolucao
nacional" que fica visivel em toda vista do app (nacional e estado).
Mesma metodologia do Dia 3 Parte 4 (media de cobertura_capada por ano,
ignorando NaN) e do Dia 4 Parte 1 ("todas" = media entre as 5 vacinas,
ignorando NaN), so que agregada em nivel nacional em vez de por municipio.

Atualizacao (extensao pro PNI, ver CLAUDE.md): a serie agora vai ate 2026,
lendo de data/processed/cobertura_mvp_2014_2026.csv (2014-2023 = VacinaBR,
2024-2026 = PNI reconstruido) em vez de serie_temporal_mvp.csv (que para em
2023). Cada ano carrega `fonte` e `ano_parcial` -- o frontend usa isso pro
selo de proveniencia no grafico.
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
    "data/processed/cobertura_mvp_2014_2026.csv",
    dtype={"ibge6": str, "uf": str, "imunizante": str},
    low_memory=False,
)

media_ano_vacina = df.groupby(["ano", "imunizante"])["cobertura_capada"].mean()
media_ano_todas = df.groupby("ano")["cobertura_capada"].mean()
fonte_por_ano = df.drop_duplicates("ano").set_index("ano")["fonte"]
ano_parcial_por_ano = df.drop_duplicates("ano").set_index("ano")["ano_parcial"]

anos = sorted(df["ano"].unique().tolist())
brasil = {}
for ano in anos:
    linha = {
        "todas": round(float(media_ano_todas.loc[ano]), 1),
        "fonte": str(fonte_por_ano.loc[ano]),
        "ano_parcial": bool(ano_parcial_por_ano.loc[ano]),
    }
    for nome_vacina, chave in CHAVE_VACINA.items():
        if (ano, nome_vacina) in media_ano_vacina.index:
            linha[chave] = round(float(media_ano_vacina.loc[(ano, nome_vacina)]), 1)
        else:
            linha[chave] = None
    brasil[str(ano)] = linha

saida = {"years": anos, "brasil": brasil}

with open("data/processed/serie_nacional.json", "w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=2)

print(f"OK - data/processed/serie_nacional.json ({len(anos)} anos: {anos[0]}-{anos[-1]})")
print("Fonte por ano:", {a: brasil[str(a)]["fonte"] for a in anos})
