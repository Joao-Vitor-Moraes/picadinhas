"""
Backend FastAPI do Picadinhas — expansao de escopo explicita em relacao ao
MVP original (ver CLAUDE.md), adicionada pra rodar deteccao de comunidades
(Louvain) sobre o grafo de similaridade do Dia 5
(data/processed/grafo_similaridade_arestas.csv) e aplicar o modelo de risco
de queda atipica (data/processed/modelo_risco.json, ver
notebooks/notebook04_risco.ipynb pro treino).

Deteccao de comunidade e global por natureza (maximiza modularidade em
relacao a densidade do grafo inteiro) — por isso a particao e computada uma
unica vez, no startup do servidor, e guardada em memoria (ver STATE). Cada
request so faz lookup nesse cache; nao recomputa nada. Como o grafo de
entrada (CSV gerado pelo pipeline do Dia 5) e estatico entre deploys,
recomputar a cada request daria exatamente o mesmo resultado (Louvain e
deterministico com seed fixa) e so gastaria CPU/latencia a toa.

O risco de queda atipica segue a mesma logica: o modelo (coeficientes de
regressao logistica) foi TREINADO offline no notebook04 — o backend nunca
treina nada, so carrega os coeficientes e aplica predict() (um produto
escalar + sigmoide, barato) sobre as features de cada municipio, que
tambem sao estaticas entre deploys (vem de clusters_municipios_mvp.csv).
Por isso o risco de todos os 5.570 municipios e calculado uma unica vez no
startup, junto com as comunidades, em vez de recalculado por request.

Rodar local: `uvicorn backend.main:app --reload` a partir da raiz do repo
(usa o mesmo .venv do pipeline Python).
"""

import json
import math
from contextlib import asynccontextmanager
from pathlib import Path

import networkx as nx
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
ARESTAS_CSV = DATA_DIR / "grafo_similaridade_arestas.csv"
CLUSTERS_CSV = DATA_DIR / "clusters_municipios_mvp.csv"
MODELO_RISCO_JSON = DATA_DIR / "modelo_risco.json"

# Preenchido no startup (ver lifespan abaixo) — cache em memoria da
# particao de comunidades + metadados por municipio + vizinhos k-NN.
STATE: dict = {}


def montar_grafo(arestas: pd.DataFrame) -> nx.Graph:
    # distancia (k-NN, Dia 5): menor = mais parecido. Modularidade do
    # Louvain espera peso = forca da conexao (maior = mais parecido), entao
    # inverte pra nao virar a semantica do algoritmo do avesso.
    arestas = arestas.copy()
    arestas["peso"] = 1.0 / (arestas["distancia"] + 1e-6)

    grafo = nx.from_pandas_edgelist(
        arestas,
        source="ibge6_origem",
        target="ibge6_destino",
        edge_attr=["peso", "distancia"],
        create_using=nx.Graph,
    )
    # from_pandas_edgelist com Graph (nao-direcionado) ja deduplica pares
    # (a,b)/(b,a) automaticamente, mantendo o ultimo peso lido — como o k-NN
    # e proximo de simetrico isso nao muda o resultado de forma relevante.
    return grafo


def detectar_comunidades(grafo: nx.Graph) -> dict[str, int]:
    comunidades = nx.community.louvain_communities(grafo, weight="peso", seed=42)
    return {
        no: indice
        for indice, comunidade in enumerate(comunidades)
        for no in comunidade
    }


def calcular_risco(clusters: pd.DataFrame, modelo: dict) -> dict[str, dict]:
    # Reconstroi exatamente as mesmas features/dummies/padronizacao do
    # treino (notebook04, Etapa F) — "causal em T=2023" = historico inteiro
    # 2014-2023, que e o que clusters_municipios_mvp.csv ja tem.
    media = modelo["scaler_mean"]
    desvio = modelo["scaler_std"]
    coef = modelo["coeficientes"]
    cortes = modelo["cortes_risco"]

    colunas_continuas = {
        "media_causal": "media_cobertura",
        "variabilidade_causal": "variabilidade_cobertura",
        "tendencia_causal": "tendencia_cobertura",
        "isolamento_causal": "isolamento_similaridade",
    }

    risco_por_no: dict[str, dict] = {}
    for linha in clusters.itertuples():
        z = coef["intercepto"]
        for i, (nome_causal, coluna) in enumerate(colunas_continuas.items()):
            valor_padronizado = (getattr(linha, coluna) - media[i]) / desvio[i]
            z += coef[nome_causal] * valor_padronizado

        nome_cluster = linha.nome_cluster
        z += coef["cluster_baixa_recuperacao"] * (1.0 if "recuperacao" in nome_cluster else 0.0)
        z += coef["cluster_queda_instavel"] * (1.0 if "instavel" in nome_cluster else 0.0)

        probabilidade = 1.0 / (1.0 + math.exp(-z))
        if probabilidade >= cortes["alto"]:
            faixa = "alto"
        elif probabilidade >= cortes["medio"]:
            faixa = "medio"
        else:
            faixa = "baixo"

        risco_por_no[linha.ibge6] = {"probabilidade": round(probabilidade, 4), "faixa": faixa}

    return risco_por_no


@asynccontextmanager
async def lifespan(app: FastAPI):
    arestas = pd.read_csv(
        ARESTAS_CSV,
        dtype={"ibge6_origem": str, "ibge6_destino": str},
    )
    clusters = pd.read_csv(CLUSTERS_CSV, dtype={"ibge6": str})
    metadados = clusters.set_index("ibge6")[["nome_municipio", "uf"]].to_dict(
        orient="index"
    )

    grafo = montar_grafo(arestas)
    comunidade_por_no = detectar_comunidades(grafo)

    with open(MODELO_RISCO_JSON, encoding="utf-8") as f:
        modelo_risco = json.load(f)
    risco_por_no = calcular_risco(clusters, modelo_risco)

    # vizinhos k-NN de cada municipio, na direcao original do Dia 5
    # (ibge6_origem -> seus 5 mais proximos), com a distancia bruta pra
    # exibir no frontend.
    vizinhos_por_no: dict[str, list[dict]] = {}
    for origem, grupo in arestas.groupby("ibge6_origem"):
        vizinhos_por_no[origem] = [
            {"ibge6": row.ibge6_destino, "distancia": row.distancia}
            for row in grupo.itertuples()
        ]

    STATE["metadados"] = metadados
    STATE["comunidade_por_no"] = comunidade_por_no
    STATE["vizinhos_por_no"] = vizinhos_por_no
    STATE["num_comunidades"] = len(set(comunidade_por_no.values()))
    STATE["grafo"] = grafo
    STATE["risco_por_no"] = risco_por_no
    STATE["modelo_risco_metadados"] = modelo_risco["metadados"]

    print(
        f"[startup] grafo: {grafo.number_of_nodes()} nos, "
        f"{grafo.number_of_edges()} arestas | "
        f"{STATE['num_comunidades']} comunidades detectadas | "
        f"risco calculado para {len(risco_por_no)} municipios "
        f"(AUC-ROC teste do modelo: {modelo_risco['metadados']['auc_roc_teste']:.3f})"
    )

    yield
    STATE.clear()


app = FastAPI(title="Picadinhas — backend de grafo", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _municipio_info(ibge6: str) -> dict:
    meta = STATE["metadados"].get(ibge6)
    return {
        "ibge6": ibge6,
        "nome_municipio": meta["nome_municipio"] if meta else None,
        "uf": meta["uf"] if meta else None,
        "comunidade": STATE["comunidade_por_no"].get(ibge6),
        "risco": STATE["risco_por_no"].get(ibge6),
    }


@app.get("/municipios/{ibge6}/rede")
def rede_municipio(ibge6: str):
    if ibge6 not in STATE["comunidade_por_no"]:
        raise HTTPException(status_code=404, detail="ibge6 nao encontrado no grafo")

    vizinhos = [
        {**_municipio_info(v["ibge6"]), "distancia": v["distancia"]}
        for v in STATE["vizinhos_por_no"].get(ibge6, [])
    ]

    # sub-grafo induzido pelo municipio + seus vizinhos: inclui tambem
    # arestas entre os proprios vizinhos (nao so centro->vizinho), que
    # existem de verdade no k-NN e tornam a visualizacao uma rede local, nao
    # uma estrela trivial.
    nos_locais = [ibge6] + [v["ibge6"] for v in vizinhos]
    subgrafo = STATE["grafo"].subgraph(nos_locais)
    arestas = [
        {"origem": a, "destino": b, "distancia": dados["distancia"]}
        for a, b, dados in subgrafo.edges(data=True)
    ]

    return {
        "municipio": _municipio_info(ibge6),
        "vizinhos": vizinhos,
        "arestas": arestas,
        "num_comunidades_total": STATE["num_comunidades"],
    }
