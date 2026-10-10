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
Pipeline Python (pandas + numpy; scikit-learn indisponível nesta máquina, ver
"Decisões já tomadas") roda localmente → gera JSON em data/processed/ →
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
- `cobertura` pode passar de 100% (população-alvo é estimativa do IBGE, não contagem
  exata — isso é normal no dado brasileiro, não é erro). A partir de agora,
  `data/processed/serie_temporal_mvp.csv` tem as duas colunas: `cobertura` (valor bruto,
  preservado intacto pra quem for auditar) e `cobertura_capada` (`clip(0, 100)`) — use
  `cobertura_capada` como padrão em gráficos e modelos daqui pra frente.
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
- Modelagem (clustering) fica em `notebooks/notebook02_clustering.ipynb`, separado do
  notebook de limpeza/EDA (`notebook01.ipynb`).
- Features de clustering (Dia 4, Parte 1): perfil combinado — 3 features por
  município (não por vacina), juntando as 5 vacinas num comportamento geral via
  média de `cobertura_capada` entre as 5 vacinas por (ibge6, ano), ignorando NaN.
  Regra de elegibilidade: município precisa de >= 7 dos 10 anos (2014-2023) com
  valor válido nessa série geral pra entrar no clustering (fica documentado, não é
  removido dos dados brutos, só não participa do modelo).
  - Resultado: **todos os 5.570 municípios passaram no filtro** (0 ficaram de fora) —
    a média entre as 5 vacinas só vira NaN quando nenhuma das 5 tem dado naquele
    ano/município, o que só acontece em 16 das 55.700 combinações (ibge6, ano); a
    regra de 7/10 anos, portanto, não excluiu ninguém nesse dataset.
  - Tabela salva em `data/processed/features_clustering_mvp.csv` (5.570 linhas):
    `ibge6`, `uf`, `n_anos_validos`, `media_cobertura`, `variabilidade_cobertura`
    (desvio padrão), `tendencia_cobertura` (slope de regressão linear via
    `numpy.polyfit`). Sem NaN em nenhuma das 3 features.
- **scikit-learn indisponível nesta máquina** (relevante pra qualquer dia futuro que
  precisar de alguma lib de ML): o `scipy` — dependência do sklearn, inclusive pra
  `KMeans` e `silhouette_score` — é bloqueado pelo Device Guard/Controle de Aplicativo
  da organização ao carregar suas DLLs compiladas (`_flapack`, `_qhull` etc), erro
  confirmado em duas instalações Python diferentes nesta máquina. `numpy` funciona
  normalmente. Solução adotada: `StandardScaler`, `KMeans` (inicialização k-means++ +
  algoritmo de Lloyd, com `n_init` e `random_state`) e `silhouette_score` foram
  reimplementados do zero em numpy puro em `notebooks/notebook02_clustering.ipynb`,
  validados contra um dataset de brinquedo calculado à mão antes de rodar nos dados
  reais. Reaproveitar essas funções (não reinstalar scikit-learn) em dias futuros,
  a menos que o bloqueio do Device Guard seja resolvido.
- Dia 4 — escolha de K pro KMeans: K=2 a 10 testados (ver `escolha_k_clustering.png`).
  Cotovelo (inertia) sem quebra única, desacelerando de forma mais visível entre K=5 e
  K=7. Silhouette score com pico claro em **K=3** (0,3672, acima de qualquer outro K
  com folga). **Decisão: K=3**, priorizando separação estatística (silhouette) e
  simplicidade de interpretação pro portfólio, mesmo sabendo que o cotovelo sugeria
  algo entre 5 e 7.
- Dia 4 — clusters finais (K=3, `data/processed/clusters_municipios_mvp.csv`,
  5.570 municípios, `random_state=42`):
  - **Cluster "Cobertura alta e estável"** (n=2.860): `media_cobertura` 86,9%,
    `variabilidade_cobertura` 8,95 (menor variação), `tendencia_cobertura` -0,37
    (praticamente estável). UFs mais frequentes: MG, RS, SP, PR, SC.
  - **Cluster "Cobertura baixa, em recuperação"** (n=1.391): `media_cobertura` 70,3%
    (a menor), `variabilidade_cobertura` 15,9, `tendencia_cobertura` +1,81 (a única
    tendência média positiva dos 3 clusters). UFs mais frequentes: PI, BA, SP, MG, PB.
  - **Cluster "Cobertura em queda e instável"** (n=1.319): `media_cobertura` 75,1%,
    `variabilidade_cobertura` 17,8 (a maior), `tendencia_cobertura` -2,69 (a mais
    negativa). UFs mais frequentes: MG, SP, MA, BA, RS.
  - Padrão regional: RR e AC não aparecem no cluster "alta e estável" (ficam ~90%+
    divididos entre os outros dois); PA e RJ concentram boa parte em "queda e
    instável" — consistente com o que já aparecia no ranking de 2023 do Dia 3. PB,
    apesar de aparecer no topo do ranking pontual de 2023, cai majoritariamente em
    "baixa, em recuperação" — ou seja, partiu de um nível baixo e vem subindo rápido,
    enquanto CE/MT/TO (também top-2023) caem majoritariamente em "alta e estável".

## Roadmap (7 dias)
Dia 1 Setup ✅ | Dia 2 Coleta ✅ |
Dia 3 Limpeza & EDA ✅ concluído (Parte 1 filtragem segura + CSV limpo; Parte 2
validações contra o dicionário; Parte 3 série temporal com grid completo
ibge6×ano×vacina e buracos explícitos em `data/processed/serie_temporal_mvp.csv`,
278.500 linhas; Parte 4 primeiros gráficos — evolução temporal nacional por vacina
e comparação entre estados em 2023, salvos em `notebooks/`) |
Dia 4 Clustering ✅ concluído — features (Parte 1), padronização + escolha de K via
cotovelo/silhouette (Partes 2-3), KMeans final com K=3 e 3 clusters nomeados (Parte 4,
ver acima: "Cobertura alta e estável" 2.860 municípios, "Cobertura baixa, em
recuperação" 1.391, "Cobertura em queda e instável" 1.319) |
Dia 5 Destaques (próximo passo — detecção de município com queda atípica via z-score) |
Dia 6 Frontend | Dia 7 Deploy