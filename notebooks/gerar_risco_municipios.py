"""
Resumo nacional de risco por faixa, pro painel nacional (sem estado
selecionado). O merge do risco dentro de cada {UF}_municipios.json agora
acontece direto em gen_municipios_json.py (fonte unica), nao mais aqui --
esse script so agrega o total nacional por faixa.

Fonte: data/processed/features_causais_risco_2025.csv (ver
atualizar_features_risco_2025.py), que ja aplica o modelo treinado
(modelo_risco.json, congelado) sobre as features causais recalculadas com
2024/2025 reais -- ou seja, a previsao e "risco de queda em 2026" (ano-alvo
atualizado, ver CLAUDE.md), nao mais "risco para 2024".
"""
import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PROC = RAIZ / "data" / "processed"

risco = pd.read_csv(PROC / "features_causais_risco_2025.csv", dtype={"ibge6": str})

print("Distribuicao nacional por faixa (risco de queda em 2026):")
print(risco["risco_faixa"].value_counts())

resumo = {
    "ano_alvo_previsao": 2026,
    "n_total": int(len(risco)),
    "n_baixo": int((risco["risco_faixa"] == "baixo").sum()),
    "n_medio": int((risco["risco_faixa"] == "medio").sum()),
    "n_alto": int((risco["risco_faixa"] == "alto").sum()),
}
with open(PROC / "risco_resumo.json", "w", encoding="utf-8") as f:
    json.dump(resumo, f, ensure_ascii=False, indent=2)

print(f"\nResumo nacional salvo em data/processed/risco_resumo.json: {resumo}")
