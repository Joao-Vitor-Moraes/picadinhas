"""
Resumo nacional de risco por faixa, pro painel nacional (sem estado
selecionado). O merge do risco dentro de cada {UF}_municipios.json agora
acontece direto em gen_municipios_json.py (fonte unica), nao mais aqui --
esse script so agrega o total nacional por faixa.

Fonte: data/processed/features_causais_risco_aplicacao.csv (ver
atualizar_features_risco_aplicacao.py), que ja aplica o modelo treinado
(modelo_risco.json, congelado) sobre as features causais recalculadas com os
anos novos reais -- ou seja, a previsao e pro ano seguinte ao ultimo dado
disponivel (ano-alvo lido do proprio CSV, de-hardcoded no Dia 8), nao mais
"risco para 2024".
"""
import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PROC = RAIZ / "data" / "processed"

risco = pd.read_csv(PROC / "features_causais_risco_aplicacao.csv", dtype={"ibge6": str})

# ano-alvo vem do proprio CSV (NAO chumbado) -- avanca sozinho conforme entra
# dado novo, ver atualizar_features_risco_aplicacao.py (de-hardcode do Dia 8).
ano_alvo = int(risco["ano_alvo_previsao"].iloc[0])

print(f"Distribuicao nacional por faixa (risco de queda em {ano_alvo}):")
print(risco["risco_faixa"].value_counts())

resumo = {
    "ano_alvo_previsao": ano_alvo,
    "n_total": int(len(risco)),
    "n_baixo": int((risco["risco_faixa"] == "baixo").sum()),
    "n_medio": int((risco["risco_faixa"] == "medio").sum()),
    "n_alto": int((risco["risco_faixa"] == "alto").sum()),
}
with open(PROC / "risco_resumo.json", "w", encoding="utf-8") as f:
    json.dump(resumo, f, ensure_ascii=False, indent=2)

print(f"\nResumo nacional salvo em data/processed/risco_resumo.json: {resumo}")
