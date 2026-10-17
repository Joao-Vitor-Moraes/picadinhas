"""SINASC por ano, com relatorio de completude mensal (pra detectar ano parcial)."""
import io
import struct
import sys
import urllib.request
import zlib

import pandas as pd

ANOS, SAIDA = sys.argv[1].split(","), sys.argv[2]
URL = "https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SINASC/csv/SINASC_{ano}_csv.zip"

partes, relatorio = [], []
for ano in ANOS:
    with urllib.request.urlopen(urllib.request.Request(URL.format(ano=ano)), timeout=600) as r:
        bruto = r.read()
    tn, = struct.unpack_from("<H", bruto, 26)
    te, = struct.unpack_from("<H", bruto, 28)
    texto = zlib.decompressobj(-15).decompress(bruto[30 + tn + te:])

    df = pd.read_csv(io.BytesIO(texto), sep=";", usecols=["CODMUNRES", "DTNASC"],
                     dtype=str, encoding="utf-8", low_memory=False)
    df["ano_nasc"] = df["DTNASC"].str[-4:]
    df["mes_nasc"] = df["DTNASC"].str[2:4]
    df = df[(df["ano_nasc"] == ano) & df["CODMUNRES"].notna()]

    meses = df["mes_nasc"].value_counts().sort_index()
    relatorio.append(f"SINASC {ano}: {len(df):,} nascidos | {df['CODMUNRES'].nunique():,} municipios | "
                     f"meses com dado: {meses.index.min()}-{meses.index.max()} ({len(meses)} meses)")
    relatorio.append(f"   por mes: {meses.to_dict()}")

    c = df.groupby("CODMUNRES").size().rename("nascidos_vivos").reset_index()
    c = c.rename(columns={"CODMUNRES": "ibge6"})
    c["ano_nascimento"] = ano
    c["n_meses_dado"] = len(meses)
    partes.append(c)
    print(relatorio[-2], flush=True)

pd.concat(partes).to_csv(SAIDA, index=False)
print("\n".join(relatorio))
print(f"Salvo: {SAIDA}")
