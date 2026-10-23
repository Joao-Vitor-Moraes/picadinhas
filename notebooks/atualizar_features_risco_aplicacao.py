"""
Atualiza o ANO-ALVO do modelo de risco de queda atipica, SEM retreinar nada.

Contexto: o modelo original (notebook04_risco.ipynb, modelo_risco.json) foi
treinado com 2014-2023 e aplicado sobre as features causais em T=2023 (ultimo
ano disponivel na epoca) para gerar "risco para 2024". Conforme anos novos
viram dado real (reconstruido do PNI, ver CLAUDE.md), aquele alvo fica
obsoleto. O modelo (coeficientes + padronizacao) continua EXATAMENTE o mesmo;
so a MATERIA-PRIMA (as features causais) e recalculada incluindo os anos
novos, deslocando o ano-alvo da previsao pra frente.

ANO-ALVO SEM CHUMBO (Dia 8): T nao e mais escrito na mao. T = o ULTIMO ano
disponivel no dado (`ano.max()`), e o alvo e sempre T+1. Hoje o dado vai ate
2026, entao T=2026 -> previsao "risco de queda em 2027". Quando entrar dado
de um ano novo, T e o alvo avancam sozinhos, sem editar este arquivo.

IMPORTANTE -- base pode ser ANO PARCIAL: diferente da versao anterior (que
cortava em 2025 pra ficar so com anos cheios), agora TODOS os anos entram,
inclusive o ultimo se for parcial (ex: 2026 tem so 8 meses). Isso infla a
PROBABILIDADE ABSOLUTA de risco (o mergulho do ano parcial puxa a tendencia
de todo municipio pra baixo), MAS a FAIXA (Alto/Medio/Baixo) e por PERCENTIL
relativo a populacao atual -- por construcao o "top ~19%" continua sendo
~19%, independente do deslocamento da distribuicao. Por isso a UI mostra um
selo de "estimativa" avisando que a base e ano incompleto (decisao do Dia 8).

Isso reaproveita a mesma logica causal/rolling e o mesmo pipeline de
cluster/isolamento por corte transversal do notebook04 (Etapas A/B), so que
rodado numa unica vez em T (nao pros 10 anos de treino -- aqui so precisamos
do ponto de aplicacao mais recente).
"""
import json

import numpy as np
import pandas as pd

RAIZ = r"C:\Users\Joao Vitor\Picadinhas"
PROC = f"{RAIZ}/data/processed"

# ---------- Passo 1: cobertura geral por (ibge6, ano), TODOS os anos disponiveis ----------
# (inclui o ultimo ano mesmo se parcial -- ver docstring; de-hardcoded no Dia 8:
#  nao ha mais filtro `ano <= <ano fixo>`.)
mvp = pd.read_csv(f"{PROC}/cobertura_mvp_2014_2026.csv", dtype={"ibge6": str, "imunizante": str}, low_memory=False)
cobertura_geral = mvp.groupby(["ibge6", "ano"])["cobertura_capada"].mean().reset_index()
cobertura_geral_valid = cobertura_geral.dropna(subset=["cobertura_capada"]).sort_values(["ibge6", "ano"])

ANO_MIN = int(cobertura_geral_valid["ano"].min())
ANO_MAX = int(cobertura_geral_valid["ano"].max())
print(f"cobertura geral valida ({ANO_MIN}-{ANO_MAX}): {len(cobertura_geral_valid)} linhas")


# ---------- Passo 2: features causais (expanding), mesma funcao do notebook04 ----------
def causal_features_grupo(grupo):
    grupo = grupo.sort_values("ano")
    anos = grupo["ano"].values.astype(float)
    valores = grupo["cobertura_capada"].values
    linhas = []
    for j in range(len(valores)):
        anos_j = anos[: j + 1]
        valores_j = valores[: j + 1]
        n_validos = j + 1
        media = valores_j.mean()
        if n_validos >= 2:
            variab = valores_j.std(ddof=1)
            slope = np.polyfit(anos_j, valores_j, 1)[0]
        else:
            variab = np.nan
            slope = np.nan
        linhas.append({
            "ano": anos[j], "n_validos_causal": n_validos,
            "media_causal": media, "variabilidade_causal": variab, "tendencia_causal": slope,
        })
    return pd.DataFrame(linhas)


causal = (
    cobertura_geral_valid.groupby("ibge6")
    .apply(causal_features_grupo, include_groups=False)
    .reset_index()
    .drop(columns=["level_1"])
)
causal["ano"] = causal["ano"].astype(int)

# T = ultimo ano disponivel, detectado do proprio dado (NAO chumbado). Alvo = T+1.
T = int(cobertura_geral_valid["ano"].max())
ANO_ALVO = T + 1
MIN_ANOS_CAUSAL = 3
sub = causal[(causal["ano"] == T) & (causal["n_validos_causal"] >= MIN_ANOS_CAUSAL)].copy()
print(f"municipios elegiveis em T={T} (>= {MIN_ANOS_CAUSAL} anos de historico): {len(sub)}  "
      f"-> previsao para T+1={ANO_ALVO}")


# ---------- Passo 3: cluster + isolamento no corte transversal de T (mesmas funcoes do notebook04) ----------
def kmeans_plus_plus_init(X, k, rng):
    n = X.shape[0]
    centros = np.empty((k, X.shape[1]))
    centros[0] = X[rng.integers(n)]
    dist_sq = np.sum((X - centros[0]) ** 2, axis=1)
    for i in range(1, k):
        probs = dist_sq / dist_sq.sum()
        centros[i] = X[rng.choice(n, p=probs)]
        nova_dist_sq = np.sum((X - centros[i]) ** 2, axis=1)
        dist_sq = np.minimum(dist_sq, nova_dist_sq)
    return centros


def kmeans_lloyd(X, k, centros_iniciais, max_iter=300, tol=1e-4):
    centros = centros_iniciais.copy()
    for _ in range(max_iter):
        dists = ((X[:, None, :] - centros[None, :, :]) ** 2).sum(axis=2)
        labels = dists.argmin(axis=1)
        novos_centros = centros.copy()
        for j in range(k):
            membros = X[labels == j]
            if len(membros) > 0:
                novos_centros[j] = membros.mean(axis=0)
        deslocamento = np.sum((novos_centros - centros) ** 2)
        centros = novos_centros
        if deslocamento < tol:
            break
    dists_finais = ((X[:, None, :] - centros[None, :, :]) ** 2).sum(axis=2)
    labels = dists_finais.argmin(axis=1)
    inertia = dists_finais[np.arange(len(X)), labels].sum()
    return labels, centros, inertia


def kmeans_proprio(X, k, n_init=10, random_state=42, max_iter=300):
    rng_principal = np.random.default_rng(random_state)
    melhor_inertia = np.inf
    melhor_labels = melhor_centros = None
    for _ in range(n_init):
        rng = np.random.default_rng(rng_principal.integers(0, 2**32 - 1))
        centros_iniciais = kmeans_plus_plus_init(X, k, rng)
        labels, centros, inertia = kmeans_lloyd(X, k, centros_iniciais, max_iter=max_iter)
        if inertia < melhor_inertia:
            melhor_inertia, melhor_labels, melhor_centros = inertia, labels, centros
    return melhor_labels, melhor_centros, melhor_inertia


def knn_distancias(X, k=5, batch=500):
    n = X.shape[0]
    vizinhos_dist = np.zeros((n, k))
    for inicio in range(0, n, batch):
        fim = min(inicio + batch, n)
        bloco = X[inicio:fim]
        diffs = bloco[:, None, :] - X[None, :, :]
        dists = np.sqrt((diffs ** 2).sum(axis=2))
        for i_local, i_global in enumerate(range(inicio, fim)):
            dists[i_local, i_global] = np.inf
        idx = np.argsort(dists, axis=1)[:, :k]
        for i_local, i_global in enumerate(range(inicio, fim)):
            vizinhos_dist[i_global] = dists[i_local, idx[i_local]]
    return vizinhos_dist


COLUNAS_3F = ["media_causal", "variabilidade_causal", "tendencia_causal"]
X = sub[COLUNAS_3F].values
media_c, desvio_c = X.mean(axis=0), X.std(axis=0, ddof=0)
Xp = (X - media_c) / desvio_c

labels, _, _ = kmeans_proprio(Xp, k=3, n_init=10, random_state=42)
sub["cluster_raw"] = labels

stats = sub.groupby("cluster_raw")[COLUNAS_3F].mean()
alta = stats["media_causal"].idxmax()
demais = stats.index.difference([alta])
recuperacao = stats.loc[demais, "tendencia_causal"].idxmax()
queda = stats.loc[demais, "tendencia_causal"].idxmin()
NOMES_LONGOS = {
    alta: "Cobertura alta e estavel",
    recuperacao: "Cobertura baixa, em recuperacao",
    queda: "Cobertura em queda e instavel",
}
sub["nome_cluster"] = sub["cluster_raw"].map(NOMES_LONGOS)

dist5 = knn_distancias(Xp, k=5, batch=500)
sub["isolamento_causal"] = dist5.mean(axis=1)

print(f"Clusters em T={T}:", sub["nome_cluster"].value_counts().to_dict())


# ---------- Passo 4: aplica o modelo JA TREINADO (congelado) sobre essas features novas ----------
with open(f"{PROC}/modelo_risco.json", encoding="utf-8") as f:
    modelo = json.load(f)

media_m = np.array(modelo["scaler_mean"])
desvio_m = np.array(modelo["scaler_std"])
coef = modelo["coeficientes"]


def aplicar_modelo(df_features, colunas_3f):
    # espera sempre as colunas *_causal (chame com o frame ja renomeado)
    cont = df_features[colunas_3f + ["isolamento_causal"]].values
    cont_padr = (cont - media_m) / desvio_m
    z = coef["intercepto"]
    for i, nome in enumerate(modelo["features_continuas"]):
        z += coef[nome] * cont_padr[:, i]
    z += coef["cluster_baixa_recuperacao"] * df_features["nome_cluster"].str.contains("recuperacao").astype(float)
    z += coef["cluster_queda_instavel"] * df_features["nome_cluster"].str.contains("instavel").astype(float)
    return 1 / (1 + np.exp(-z))


probabilidade = aplicar_modelo(sub, COLUNAS_3F)
sub["risco_probabilidade"] = probabilidade.round(4)

# ---------- Passo 5: corte por PERCENTIL relativo, nao probabilidade absoluta ----------
#
# Os cortes_risco em modelo_risco.json sao valores absolutos de probabilidade
# (0.5756/0.5153), calibrados nos percentis 90/70 do conjunto de TESTE do
# notebook04 (2021-2022). Aplicados direto como corte fixo numa populacao
# diferente, eles NAO correspondem a 10%/30% ali -- correspondem a outro
# percentil, por causa da forma da distribuicao de probabilidade ser
# diferente. E a cada ano a distribuicao de entrada se desloca (recuperacao
# pos-pandemia, e agora tambem o mergulho do ano parcial na base), entao um
# corte absoluto fixo faria a fracao "alto" variar sem mudanca real de risco
# -- o mesmo problema de covariate shift ja visto no modelo de regressao.
#
# Correcao (mesmo principio do percentil_isolamento do Dia 5 -- um corte por
# percentil mantem o significado estavel quando o contexto muda, ao contrario
# de um valor absoluto): descobre a que percentil os cortes absolutos
# correspondiam dentro da populacao ORIGINAL (2014-2023, a mesma que gerou o
# "~19%" historico) e aplica esse MESMO percentil a populacao atual -- "Alto"
# volta a significar "top ~19% dos municipios em risco relativo", nao "acima
# de um numero fixo", em qualquer ano.
clusters_originais = pd.read_csv(f"{PROC}/clusters_municipios_mvp.csv", dtype={"ibge6": str})
probabilidade_original = aplicar_modelo(
    clusters_originais.rename(columns={
        "media_cobertura": "media_causal",
        "variabilidade_cobertura": "variabilidade_causal",
        "tendencia_cobertura": "tendencia_causal",
        "isolamento_similaridade": "isolamento_causal",
    }),
    COLUNAS_3F,
)
percentil_alto = float((probabilidade_original < modelo["cortes_risco"]["alto"]).mean() * 100)
percentil_medio = float((probabilidade_original < modelo["cortes_risco"]["medio"]).mean() * 100)
print(f"\nPercentil (na populacao original 2014-2023) dos cortes absolutos antigos: "
      f"alto={percentil_alto:.2f} medio={percentil_medio:.2f}")

corte_alto_atual = float(np.percentile(probabilidade, percentil_alto))
corte_medio_atual = float(np.percentile(probabilidade, percentil_medio))
print(f"Cortes atuais (percentil {percentil_alto:.1f}/{percentil_medio:.1f} aplicado a T={T}): "
      f"alto={corte_alto_atual:.4f} medio={corte_medio_atual:.4f} "
      f"(cortes absolutos antigos eram alto={modelo['cortes_risco']['alto']:.4f} medio={modelo['cortes_risco']['medio']:.4f})")

faixa = np.where(
    probabilidade >= corte_alto_atual, "alto",
    np.where(probabilidade >= corte_medio_atual, "medio", "baixo"),
)
sub["risco_faixa"] = faixa
sub["ano_alvo_previsao"] = ANO_ALVO

print(f"\nDistribuicao de risco pra {ANO_ALVO} (modelo congelado, corte por percentil relativo):")
print(sub["risco_faixa"].value_counts())
print(f"(pra comparar: a mesma populacao com o corte ABSOLUTO antigo dava "
      f"{(probabilidade >= modelo['cortes_risco']['alto']).sum()} 'alto' = "
      f"{(probabilidade >= modelo['cortes_risco']['alto']).mean() * 100:.1f}%)")

saida = sub.rename(columns={
    "media_causal": "media_cobertura",
    "variabilidade_causal": "variabilidade_cobertura",
    "tendencia_causal": "tendencia_cobertura",
    "isolamento_causal": "isolamento_similaridade",
})[[
    "ibge6", "media_cobertura", "variabilidade_cobertura", "tendencia_cobertura",
    "isolamento_similaridade", "nome_cluster", "risco_probabilidade", "risco_faixa", "ano_alvo_previsao",
]]
saida.to_csv(f"{PROC}/features_causais_risco_aplicacao.csv", index=False)
print(f"\nSalvo: data/processed/features_causais_risco_aplicacao.csv ({len(saida)} municipios)")
print("(nomes de coluna seguem a convencao de clusters_municipios_mvp.csv de proposito,")
print(" pra backend/main.py so trocar o caminho do arquivo sem mudar a logica)")

# auditoria: documenta como os cortes atuais foram derivados (percentil, nao
# valor absoluto) -- nao e consumido por nenhum outro script, so registro.
with open(f"{PROC}/cortes_risco_percentil.json", "w", encoding="utf-8") as f:
    json.dump({
        "metodologia": (
            "Corte por percentil relativo (mesmo principio do percentil_isolamento "
            "do Dia 5), nao probabilidade absoluta fixa -- ver CLAUDE.md."
        ),
        "ano_base": T,
        "ano_alvo_previsao": ANO_ALVO,
        "percentil_alto": round(percentil_alto, 2),
        "percentil_medio": round(percentil_medio, 2),
        "derivado_de": "cortes_risco absolutos de modelo_risco.json, aplicados a clusters_municipios_mvp.csv (2014-2023)",
        "corte_absoluto_atual_alto": round(corte_alto_atual, 4),
        "corte_absoluto_atual_medio": round(corte_medio_atual, 4),
        "populacao_referencia": f"features_causais_risco_aplicacao.csv (T={T})",
    }, f, ensure_ascii=False, indent=2)
print("Salvo: data/processed/cortes_risco_percentil.json (auditoria da calibracao)")
