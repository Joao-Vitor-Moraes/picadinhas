"""
Backend FastAPI do Picadinhas — expansao de escopo explicita em relacao ao
MVP original (ver CLAUDE.md), adicionada pra rodar deteccao de comunidades
(Louvain) sobre o grafo de similaridade do Dia 5
(data/processed/grafo_similaridade_arestas.csv).

Deteccao de comunidade e global por natureza (maximiza modularidade em
relacao a densidade do grafo inteiro) — por isso a particao e computada uma
unica vez, no startup do servidor, e guardada em memoria (ver STATE). Cada
request so faz lookup nesse cache; nao recomputa nada. Como o grafo de
entrada (CSV gerado pelo pipeline do Dia 5) e estatico entre deploys,
recomputar a cada request daria exatamente o mesmo resultado (Louvain e
deterministico com seed fixa) e so gastaria CPU/latencia a toa.

Rodar local: `uvicorn backend.main:app --reload` a partir da raiz do repo
(usa o mesmo .venv do pipeline Python).
"""

from contextlib import asynccontextmanager
from pathlib import Path

import networkx as nx
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
ARESTAS_CSV = DATA_DIR / "grafo_similaridade_arestas.csv"
CLUSTERS_CSV = DATA_DIR / "clusters_municipios_mvp.csv"

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

    print(
        f"[startup] grafo: {grafo.number_of_nodes()} nos, "
        f"{grafo.number_of_edges()} arestas | "
        f"{STATE['num_comunidades']} comunidades detectadas"
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
