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
- Período: 2014-2023 (2024 não existe no dado bruto pra essas 5 vacinas)
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
- Regra final de filtro pra "esquema completo" (uma linha = município/ano/vacina):
  - Dose única (`BCG`, `Hepatite B (0 a 30 dias)`): SEM filtro de `ultima_dose`/`reforco`
    — mantém todas as linhas dessas duas vacinas.
  - Multidose (`Pentavalente`, `Poliomielite inativada`, `Tríplice Viral`): filtrar
    `ultima_dose == True` E `reforco == 0`.
  - Motivo: dose única não segue a mesma convenção de `ultima_dose`/`reforco` que
    multidose (ver pendências resolvidas abaixo).
- Período final: 2014 a 2023 (2024 não existe no dado bruto pra nenhuma das 5 vacinas
  do MVP — só HPV foi atualizado até agora).
- `dose_de_referencia` existe no CSV mas NÃO está no dicionário — evitar usar até confirmar.
- `cobertura` pode passar de 100% (população-alvo é estimativa do IBGE) — tratamento pendente.
- `faixa_etaria == 0` = "menos de 1 ano".
- Ambiente: venv .venv (Python 3.14); `pip.exe` é bloqueado pelo Device Guard da
  organização nesta máquina — usar `python -m pip install <pacote>`.
- 5 vacinas finais do MVP, com o nome exato da coluna `imunizante`: BCG,
  Poliomielite inativada, Pentavalente, Tríplice Viral, Hepatite B (0 a 30 dias).
- Checagem de duplicatas: 0 duplicatas em (`ibge6`, `ano`, `imunizante`) no CSV final
  processado (`data/processed/cobertura_mvp_2014_2023.csv`, 273.532 linhas, ano 2014-2023,
  só as 5 vacinas do MVP).
- Resolvida: ano 2024 não aparece pra nenhuma das 5 vacinas do MVP porque o VacinaBR só
  atualizou 2024 pra HPV até agora (confirmado lendo `ano` no CSV bruto sem filtro).
- Resolvida: "Hepatite B (0 a 30 dias)" desaparecia com o filtro `ultima_dose`/`reforco`
  porque é dose única e `ultima_dose` nunca é `True` pra essa vacina no dado bruto — por
  isso a regra final não aplica esse filtro pras vacinas de dose única.
- Comando pra registrar o kernel do notebook no `.venv`:
  `python -m ipykernel install --user --name=picadinhas --display-name "Picadinhas (.venv)"`.

## Roadmap (7 dias)
Dia 1 Setup ✅ | Dia 2 Coleta ✅ |
Dia 3 Limpeza & EDA (Parte 1 — filtragem segura + CSV limpo em data/processed/ ✅
concluída; seguem as próximas partes do dia) |
Dia 4 Clustering | Dia 5 Destaques | Dia 6 Frontend | Dia 7 Deploy