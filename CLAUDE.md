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
- 5 vacinas finais do MVP, com o nome exato da coluna `imunizante`: BCG,
  Poliomielite inativada, Pentavalente, Tríplice Viral, Hepatite B (0 a 30 dias).
- Checagem de duplicatas: 0 duplicatas em (`ibge6`, `ano`, `imunizante`) após o filtro
  (`ultima_dose == True`, `reforco == 0`, ano 2014-2024, 5 vacinas do MVP).
- Pendência aberta: ano 2024 não aparece em nenhuma linha após o filtro. Hipótese
  principal: o VacinaBR ainda não tem dado de 2024. A confirmar olhando o `ano` no
  CSV bruto sem filtro.
- Pendência aberta: "Hepatite B (0 a 30 dias)" não aparece após o filtro de
  `ultima_dose`/`reforco`. Hipótese: vacina de dose única não segue a mesma convenção
  dessas flags. A investigar.
- Comando pra registrar o kernel do notebook no `.venv`:
  `python -m ipykernel install --user --name=picadinhas --display-name "Picadinhas (.venv)"`.

## Roadmap (7 dias)
Dia 1 Setup ✅ | Dia 2 Coleta ✅ |
Dia 3 Limpeza & EDA (EM ANDAMENTO — filtro feito, 2 pendências de investigação antes de salvar o CSV processado) |
Dia 4 Clustering | Dia 5 Destaques | Dia 6 Frontend | Dia 7 Deploy