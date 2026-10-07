# Picadinhas — Contexto do Projeto

## O que é
App interativo sobre cobertura vacinal nos municípios brasileiros — Data Analytics +
Data Science + Full Stack, pra portfólio de estágio em dados.
Pergunta central: como a cobertura vacinal dos municípios brasileiros está evoluindo,
e quais municípios apresentam padrões que merecem atenção?

## Como trabalhar comigo neste projeto
- Sou iniciante aprendendo ativamente — não quero código pronto sem explicação.
- Antes de escrever código, explica o CONCEITO por trás (o que é, por que essa abordagem).
- Pode agrupar passos mecânicos numa célula só, mas PARA pra eu decidir em pontos de
  julgamento real (ex: que vacinas, como tratar outlier, qual algoritmo).
- Prefiro entender o "porquê" a só copiar e colar.

## Escopo do MVP (não expandir sem decisão explícita)
- Vacinas: BCG, Poliomielite, Pentavalente, Tríplice viral, Hepatite B
- Período: ~2014-2024
- Mapa por estado + ranking/busca por município (não mapa municipal completo)
- Fora de escopo: previsão, cruzamento socioeconômico

## Arquitetura
Pipeline Python (pandas/scikit-learn) roda localmente → gera JSON em data/processed/ →
frontend React (Vite) só lê esses JSONs, sem backend/banco → deploy Vercel/Netlify.
Dado bruto NÃO vai pro git (ver .gitignore).

## Fonte de dados
VacinaBR (iqc.org.br/observatorio/vacinabr) — dump completo em
data/raw/vacinabr-dados-por-municipio.csv (~600MB, fora do git).
Dicionário: data/raw/dicionario-dados-por-municipio.csv.

## Decisões já tomadas
- Cobertura "oficial" por vacina = filtrar `ultima_dose == True` e `reforco == 0`.
- `dose_de_referencia` existe no CSV mas NÃO está no dicionário — evitar usar até confirmar.
- `cobertura` pode passar de 100% (população-alvo é estimativa do IBGE) — tratamento pendente.
- `faixa_etaria == 0` = "menos de 1 ano".
- Ambiente: venv .venv (Python 3.14); `pip.exe` é bloqueado pelo Device Guard da
  organização nesta máquina — usar `python -m pip install <pacote>`.

## Roadmap (7 dias)
Dia 1 Setup ✅ | Dia 2 Coleta ✅ | Dia 3 Limpeza & EDA (EM ANDAMENTO) |
Dia 4 Clustering | Dia 5 Destaques | Dia 6 Frontend | Dia 7 Deploy