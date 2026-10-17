"""
Captura um mes do PNI guardando a CHAVE de deduplicacao, pra permitir dedup
conservadora entre meses diferentes (Etapa 1).

Chave = hash(co_paciente | dt_vacina | ds_tipo_dose). Usa
pd.util.hash_pandas_object, que e deterministico entre processos — o hash()
nativo do Python e randomizado por processo (PYTHONHASHSEED) e quebraria a
dedup cruzada.

Uso: capturar_mes.py <ano> <mes> <arquivo_saida.pkl>
"""
import io
import struct
import sys
import time
import urllib.request
import zlib

import pandas as pd

import os

ANO, MES, SAIDA = sys.argv[1], sys.argv[2], sys.argv[3]
URL = f"https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/PNI/csv/vacinacao_{MES}_{ANO}_csv.zip"

# ja capturado numa execucao anterior: nao refaz (o S3 derruba conexao de vez em
# quando e o mes precisa ser retentado; sem isso a retentativa custaria o dobro)
if os.path.exists(SAIDA):
    print(f"[{MES}/{ANO}] ja existe, pulando", flush=True)
    sys.exit(0)

COLUNAS = ["co_paciente", "co_municipio_paciente", "sg_imunobiologico",
           "ds_tipo_dose", "nu_idade_paciente", "dt_vacina", "dt_deletado_rnds"]

DOSE_UNICA = {"Única", "Dose", "Dose Inicial", "1ª Dose"}
REGRAS = {
    "BCG": ({"BCG"}, DOSE_UNICA, "0"),
    "Hepatite B (0 a 30 dias)": ({"HB"}, DOSE_UNICA, "0"),
    "Pentavalente": ({"Penta", "Hexa acelular"}, {"3ª Dose"}, "0"),
    "Poliomielite inativada": ({"VIP"}, {"3ª Dose"}, "0"),
    "Tríplice Viral": ({"SCR"}, DOSE_UNICA, "1"),
}
TODAS_SIGLAS = {s for siglas, _, _ in REGRAS.values() for s in siglas}

pedacos = []
t0 = time.time()
linhas_lidas = 0
TENTATIVAS = 4


def tratar(df):
    global linhas_lidas
    linhas_lidas += len(df)
    df = df[df["sg_imunobiologico"].isin(TODAS_SIGLAS)]
    if df.empty:
        return
    df = df[df["dt_deletado_rnds"].isna() & df["co_municipio_paciente"].notna()]
    if df.empty:
        return
    saida = []
    for nome, (siglas, doses, idade) in REGRAS.items():
        sub = df[df["sg_imunobiologico"].isin(siglas)
                 & df["ds_tipo_dose"].isin(doses)
                 & (df["nu_idade_paciente"] == idade)]
        if sub.empty:
            continue
        chave_txt = (sub["co_paciente"].fillna("?") + "|"
                     + sub["dt_vacina"].fillna("?") + "|"
                     + sub["ds_tipo_dose"].fillna("?"))
        saida.append(pd.DataFrame({
            "ibge6": sub["co_municipio_paciente"].astype(str).str.zfill(6).values,
            "imunizante": nome,
            "chave": pd.util.hash_pandas_object(chave_txt, index=False).values,
        }))
    if saida:
        pedacos.append(pd.concat(saida, ignore_index=True))


def baixar_e_processar():
  global pedacos, linhas_lidas
  pedacos, linhas_lidas = [], 0
  with urllib.request.urlopen(urllib.request.Request(URL), timeout=300) as resp:
    cab = resp.read(30)
    tn, = struct.unpack_from("<H", cab, 26)
    te, = struct.unpack_from("<H", cab, 28)
    resp.read(tn + te)

    d = zlib.decompressobj(-15)
    buffer, header = b"", None
    while True:
        pedaco = resp.read(8 * 1024 * 1024)
        if not pedaco:
            break
        texto = d.decompress(pedaco)
        if not texto:
            continue
        buffer += texto
        if header is None:
            corte = buffer.find(b"\n")
            if corte == -1:
                continue
            header, buffer = buffer[:corte].rstrip(b"\r"), buffer[corte + 1:]
        if len(buffer) >= 32 * 1024 * 1024:
            corte = buffer.rfind(b"\n")
            if corte == -1:
                continue
            bloco, buffer = buffer[:corte], buffer[corte + 1:]
            tratar(pd.read_csv(io.BytesIO(header + b"\n" + bloco), sep=";", usecols=COLUNAS,
                               dtype=str, encoding="latin-1", low_memory=False, on_bad_lines="skip"))

    if buffer.strip() and header is not None:
        tratar(pd.read_csv(io.BytesIO(header + b"\n" + buffer.rstrip(b"\r\n")), sep=";", usecols=COLUNAS,
                           dtype=str, encoding="latin-1", low_memory=False, on_bad_lines="skip"))


for tentativa in range(1, TENTATIVAS + 1):
    try:
        baixar_e_processar()
        break
    except Exception as erro:
        if tentativa == TENTATIVAS:
            print(f"[{MES}/{ANO}] FALHOU apos {TENTATIVAS} tentativas: {erro}", flush=True)
            raise
        espera = 15 * tentativa
        print(f"[{MES}/{ANO}] tentativa {tentativa} falhou ({type(erro).__name__}), "
              f"repetindo em {espera}s", flush=True)
        time.sleep(espera)

final = pd.concat(pedacos, ignore_index=True) if pedacos else pd.DataFrame(
    columns=["ibge6", "imunizante", "chave"])
final["imunizante"] = final["imunizante"].astype("category")
final.to_pickle(SAIDA)
print(f"[{MES}/{ANO}] {linhas_lidas:,} linhas lidas | {len(final):,} doses capturadas | "
      f"{time.time() - t0:.0f}s", flush=True)
