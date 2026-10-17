"""
Etapa 1 — monta a cobertura reconstruida de 2024-2026 e os CSVs finais.

Passos:
 1. junta as chaves de todos os meses de cada ano e aplica a DEDUP CONSERVADORA
    (mesmo paciente + mesma data + mesmo tipo de dose) sobre o ANO INTEIRO,
    capturando duplicata entre meses diferentes
 2. divide pelo denominador do SINASC (nascidos vivos por municipio de
    residencia; ano anterior no caso da Triplice Viral, que e avaliada aos 1 ano)
 3. escreve:
      - cobertura_reconstruida_pni_2024_2026.csv  (so os anos novos)
      - cobertura_mvp_2014_2026.csv               (original + novos, com `fonte`)
    O original cobertura_mvp_2014_2023.csv NAO e tocado.
"""
import glob
import sys

import numpy as np
import pandas as pd

SCRATCH = sys.argv[1]
RAIZ = r"C:\Users\Joao Vitor\Picadinhas"
PROC = f"{RAIZ}/data/processed"

MESES_ORDEM = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
ANOS = ["2024", "2025", "2026"]
TRIPLICE = "Tríplice Viral"

log = []
def p(*a):
    linha = " ".join(str(x) for x in a)
    log.append(linha)
    print(linha, flush=True)


# ---------- 1. dedup anual ----------
numeradores = []
p("=" * 78)
p("DEDUP CONSERVADORA POR ANO (mesmo paciente + mesma data + mesmo tipo de dose)")
p("=" * 78)
# Alinhamento de janela em ano parcial: o PNI 2026 publicou ate setembro, mas o
# SINASC 2026 (2a previa) so vai ate agosto. Usar 9 meses de doses contra 8 de
# nascidos vivos inflaria a cobertura em ~12% so por descasamento aritmetico —
# entao o numerador e cortado na mesma janela do denominador.
sinasc_prev = pd.read_csv(f"{SCRATCH}/sinasc_2023_2026.csv", dtype={"ibge6": str, "ano_nascimento": str})
MESES_SINASC = sinasc_prev.drop_duplicates("ano_nascimento").set_index("ano_nascimento")["n_meses_dado"].to_dict()

meses_por_ano = {}
for ano in ANOS:
    arquivos = sorted(glob.glob(f"{SCRATCH}/chaves/{ano}_*.pkl"))
    meses = [a.replace("\\", "/").split("/")[-1].replace(f"{ano}_", "").replace(".pkl", "") for a in arquivos]
    meses = sorted(meses, key=lambda m: MESES_ORDEM.index(m))

    limite = MESES_SINASC.get(ano, 12)
    if len(meses) > limite:
        descartados = meses[limite:]
        p(f"\n[{ano}] numerador tem {len(meses)} meses mas o SINASC {ano} so tem {limite} — "
          f"cortando {', '.join(descartados)} pra alinhar a janela")
        meses = meses[:limite]
        arquivos = [a for a in arquivos if any(f"{ano}_{m}.pkl" in a.replace("\\", "/") for m in meses)]

    meses_por_ano[ano] = meses
    if not arquivos:
        p(f"{ano}: NENHUM arquivo encontrado"); continue

    bruto = pd.concat([pd.read_pickle(a) for a in arquivos], ignore_index=True)
    antes = len(bruto)
    limpo = bruto.drop_duplicates(["imunizante", "chave"])
    removidas = antes - len(limpo)
    p(f"\n{ano} ({len(arquivos)} meses: {', '.join(meses_por_ano[ano])})")
    p(f"  doses brutas: {antes:,} | apos dedup: {len(limpo):,} | removidas: {removidas:,} ({removidas / antes * 100:.1f}%)")
    por_vac = (bruto.groupby("imunizante", observed=True).size().rename("bruto").to_frame()
               .join(limpo.groupby("imunizante", observed=True).size().rename("dedup")))
    por_vac["removido_%"] = ((1 - por_vac["dedup"] / por_vac["bruto"]) * 100).round(1)
    for imun, r in por_vac.iterrows():
        p(f"    {imun[:26]:28s} {int(r['bruto']):>9,} -> {int(r['dedup']):>9,}  (-{r['removido_%']:.1f}%)")

    cont = limpo.groupby(["ibge6", "imunizante"], observed=True).size().rename("qt_dose").reset_index()
    cont["ano"] = int(ano)
    numeradores.append(cont)

numerador = pd.concat(numeradores, ignore_index=True)

# ---------- 2. denominador ----------
sinasc = pd.read_csv(f"{SCRATCH}/sinasc_2023_2026.csv", dtype={"ibge6": str, "ano_nascimento": str})
sinasc_meses = sinasc.drop_duplicates("ano_nascimento").set_index("ano_nascimento")["n_meses_dado"].to_dict()

# Triplice Viral e avaliada aos 1 ano -> coorte nascida no ano anterior
numerador["ano_denominador"] = np.where(
    numerador["imunizante"] == TRIPLICE,
    (numerador["ano"] - 1).astype(str),
    numerador["ano"].astype(str),
)
df = numerador.merge(
    sinasc.rename(columns={"ano_nascimento": "ano_denominador"})[["ibge6", "ano_denominador", "nascidos_vivos"]],
    on=["ibge6", "ano_denominador"], how="left")

p("")
p(f"linhas sem denominador (municipio sem nascidos vivos no SINASC): {df['nascidos_vivos'].isna().sum():,}")
df = df[df["nascidos_vivos"].notna() & (df["nascidos_vivos"] > 0)]

df["cobertura"] = df["qt_dose"] / df["nascidos_vivos"] * 100
df["cobertura_capada"] = df["cobertura"].clip(0, 100)
df["populacao"] = df["nascidos_vivos"]

# ---------- 3. metadados pra casar com o CSV original ----------
orig = pd.read_csv(f"{PROC}/cobertura_mvp_2014_2023.csv", dtype={"ibge6": str}, low_memory=False)
metas = orig.drop_duplicates("imunizante").set_index("imunizante")["meta"].to_dict()
faixas = orig.drop_duplicates("imunizante").set_index("imunizante")["faixa_etaria"].to_dict()
ufs = orig.drop_duplicates("ibge6").set_index("ibge6")["uf"].to_dict()

df["meta"] = df["imunizante"].map(metas)
df["faixa_etaria"] = df["imunizante"].map(faixas)
df["uf"] = df["ibge6"].map(ufs)
df["meta_atingida"] = (df["cobertura"] >= df["meta"]).astype(float)
df["fonte"] = "pni_reconstruido"
df["meses_dado_numerador"] = df["ano"].astype(str).map({a: len(m) for a, m in meses_por_ano.items()})
df["meses_dado_denominador"] = df["ano_denominador"].map(sinasc_meses)
df["ano_parcial"] = df["meses_dado_numerador"] < 12

p(f"linhas sem UF (municipio fora da base original): {df['uf'].isna().sum():,}")

COLS = ["ibge6", "uf", "ano", "imunizante", "faixa_etaria", "populacao", "qt_dose",
        "cobertura", "cobertura_capada", "meta", "meta_atingida", "fonte",
        "meses_dado_numerador", "meses_dado_denominador", "ano_parcial"]
recon = df[COLS].sort_values(["ano", "ibge6", "imunizante"]).reset_index(drop=True)
recon.to_csv(f"{PROC}/cobertura_reconstruida_pni_2024_2026.csv", index=False)
p(f"\nSalvo: data/processed/cobertura_reconstruida_pni_2024_2026.csv ({len(recon):,} linhas)")

# ---------- 4. juncao com o original ----------
orig_out = orig.copy()
orig_out["cobertura_capada"] = orig_out["cobertura"].clip(0, 100)
orig_out["fonte"] = "vacinabr"
orig_out["meses_dado_numerador"] = 12
orig_out["meses_dado_denominador"] = 12
orig_out["ano_parcial"] = False
junto = pd.concat([orig_out[COLS], recon[COLS]], ignore_index=True)
junto = junto.sort_values(["ano", "ibge6", "imunizante"]).reset_index(drop=True)
junto.to_csv(f"{PROC}/cobertura_mvp_2014_2026.csv", index=False)
p(f"Salvo: data/processed/cobertura_mvp_2014_2026.csv ({len(junto):,} linhas)")

# ---------- 5. resumo ----------
p("")
p("=" * 78)
p("RESUMO POR ANO")
p("=" * 78)
p(f"{'ano':6s} {'fonte':18s} {'linhas':>8s} {'municipios':>11s} {'cob.media':>10s} {'min':>7s} {'max':>9s}")
for (ano, fonte), g in junto.groupby(["ano", "fonte"]):
    p(f"{ano:<6d} {fonte:18s} {len(g):>8,} {g['ibge6'].nunique():>11,} "
      f"{g['cobertura'].mean():>9.1f}% {g['cobertura'].min():>6.1f}% {g['cobertura'].max():>8.1f}%")

p("")
p("COBERTURA MEDIA POR VACINA (anos reconstruidos)")
for (ano, imun), g in recon.groupby(["ano", "imunizante"], observed=True):
    p(f"  {ano} {imun[:26]:28s} media={g['cobertura'].mean():6.1f}%  mediana={g['cobertura'].median():6.1f}%  "
      f"municipios={len(g):,}  acima de 100%: {(g['cobertura'] > 100).mean() * 100:.1f}%")

open(f"{SCRATCH}/relatorio_etapa1.txt", "w", encoding="utf-8").write("\n".join(log))
