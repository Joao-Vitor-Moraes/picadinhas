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
frontend React (Vite) lê esses JSONs direto (sem backend) pra tudo que é MVP →
deploy Vercel/Netlify. Dado bruto NÃO vai pro git (ver .gitignore).

**Atualização (branch `grafo-comunidades`): expansão de escopo explícita**
— agora existe um backend de verdade (`backend/`, FastAPI, mesmo `.venv` do
pipeline). Motivo: detecção de comunidades (Louvain, `networkx`) sobre o
grafo de similaridade do Dia 5 precisa do grafo inteiro pra fazer sentido
(modularidade é uma métrica global), então não dá pra pré-computar e
exportar como JSON estático por município como o resto do app — tem que
rodar em algum processo vivo. A partição de comunidades é computada **uma
única vez, no startup do servidor** (não por request — o grafo de entrada é
estático entre deploys, então recomputar não muda o resultado, só gasta
CPU/latência à toa; ver `backend/main.py` pro raciocínio completo), e fica
em cache em memória. Endpoint `GET /municipios/{ibge6}/rede` devolve o
município + vizinhos k-NN (Dia 5) + comunidade de cada um + arestas do
sub-grafo local (inclui arestas entre os próprios vizinhos, não só
centro→vizinho). Frontend consome via `VITE_API_BASE_URL` (padrão
`http://localhost:8000`, configurável — hospedagem do backend ainda não
decidida, fica pro Dia 7). Resto do app (mapa, ranking, filtros, séries)
continua 100% estático, sem depender do backend.

**Atualização (mesma branch): modelo de risco de queda atípica + grafo
explorável.** Treinado um classificador (regressão logística em numpy puro,
mesmo padrão do KMeans) que aprende, a partir do perfil causal de um
município até o ano T, a probabilidade de queda atípica em T+1 — aplicado
em T=2023 pra gerar "risco para 2024" por município
(`notebooks/notebook04_risco.ipynb`, artefato de produção em
`data/processed/modelo_risco.json`).
- **Vazamento temporal (ponto central):** as features existentes em
  `clusters_municipios_mvp.csv` são calculadas sobre 2014-2023 inteiro, então
  usá-las pra prever T+1 de qualquer T<2023 vaza o futuro pro passado. Pra
  treinar, todas as features (inclusive `isolamento_similaridade` e `cluster`,
  que comparam todos os municípios entre si, não são séries por município)
  foram recalculadas causalmente — o pipeline do Dia 4/5 (padronizar → KMeans
  K=3 → k-NN K=5 → isolamento) repetido pra cada ano T de 2016 a 2023, usando
  só dados até T. Validado batendo exatamente com os clusters originais em
  T=2023 (historico inteiro = "causal" no ultimo ano).
- Regra de elegibilidade pro treino: >= 3 anos causais até T (senão
  tendência/variabilidade ficam instáveis com 1-2 pontos) — exclui T=2014/2015.
- Desbalanceamento (~2,8% positivos): peso de classe (fórmula "balanced"),
  avaliado por AUC-ROC/AUC-PR (não acurácia).
- Split temporal (não aleatório, pra não vazar entre anos vizinhos do mesmo
  município): treino T=2016-2020 (prevê 2017-2021), teste T=2021-2022 (prevê
  2022-2023).
- Resultado no teste: AUC-ROC 0,667 (acima do acaso), AUC-PR 0,044 (~1,8x o
  baseline de 2,4%). Sinal real mas modesto — a causa real de uma queda
  atípica (decisão administrativa local, falta de insumo etc.) não está nas 6
  features disponíveis. Documentado explicitamente no artefato como
  ferramenta de **priorização/triagem**, não previsão precisa.
- Faixas de risco (baixo/médio/alto) por percentil da probabilidade no
  conjunto de teste (top 10% = alto, 10-30% = médio), não threshold
  arbitrário — mesma lógica de `percentil_isolamento` do Dia 5.
- **Aplicação em 2023 não precisa recalcular nada**: features causais em
  T=2023 = histórico 2014-2023 inteiro = o que `clusters_municipios_mvp.csv`
  já tem. Por isso o backend só aplica os coeficientes salvos (produto
  escalar + sigmoide) sobre dados já em memória — nunca treina nem roda
  KMeans/k-NN em runtime. Risco de todos os 5.570 municípios calculado uma
  única vez no startup (mesmo padrão das comunidades), cacheado em
  `STATE["risco_por_no"]`, exposto como campo `risco` (`probabilidade` +
  `faixa`) dentro de `_municipio_info` — logo já aparece tanto no município
  centro quanto em cada vizinho de `GET /municipios/{ibge6}/rede` (decisão:
  campo a mais no endpoint existente, não endpoint separado, porque o caso de
  uso sempre consome os dois juntos).
- **Frontend — grafo explorável** (`RedeMunicipio.tsx`): toggle
  Estático/Explorar. Estático é o painel original (centro fixo no município
  da rota). Explorar deixa clicar num vizinho pra recentralizar o grafo nele
  (chama `/rede` de novo com o novo `ibge6`, sem navegar a URL principal do
  app) e continuar explorando o espaço de similaridade; botão "voltar" some
  a exploração. Risco usa **duas codificações visuais redundantes** (skill de
  dataviz, já que a cor do nó está ocupada pela comunidade): tamanho do nó
  (sequencial, relativo aos 6 nós do painel) + anel de status colorido,
  reaproveitando a paleta de semáforo já existente no app (`--crit`/`--low`/
  `--good`) em vez de inventar cores novas. Tooltip mostra o % exato.

**Atualização (mesma branch): risco visível fora do backend + remoção de
jargão técnico da UI.** O risco só aparecia no painel de grafo (acima) —
pra ele ser visível em toda a jornada (nacional → estado → município →
ranking) sem depender do backend estar no ar (o risco é estático entre
deploys, só muda se o modelo for retreinado), ele também foi exportado como
dado estático:
- `notebooks/gerar_risco_municipios.py` (novo): aplica `modelo_risco.json`
  e grava `risco_probabilidade`/`risco_faixa` em cada `meta_municipios` de
  `data/processed/municipios/{UF}_municipios.json`, e um agregado nacional
  em `data/processed/risco_resumo.json` (novo, carregado no boot).
- `gerar_resumo_estados.py` ganhou `n_municipios_risco_alto` por estado
  (mesmo cálculo, reaproveitado).
- UI: card nacional ("Risco alto para 2024"), card de estado, card de
  município (badge baixo/médio/alto + % estimado), callout do mapa nacional
  no hover, e coluna "Risco 2024" na tabela de municípios do estado.
- **Bug encontrado e corrigido de passagem:** o bloco "Estado selecionado"
  do painel lateral (cobertura média, perfil predominante) estava dentro de
  um `if (view === "national")`, mas `useRota` só retorna `view: "state"`
  quando `uf` existe — ou seja, esse bloco nunca era alcançável. Movido pra
  dentro de `view === "state"` sem `municipioIbge6`, onde de fato renderiza.
- Jargão removido da UI (ficava visível pro usuário final, não só em
  comentário de código): rótulos como "Perfil (Dia 4)" e "Quedas atípicas
  (Dia 5)" viraram "Perfil do município"/"Quedas bruscas registradas";
  caption técnica "z-score < −2 vs. a média do mesmo ano" virou explicação
  em português simples. Referências a "Dia N" ficam só em comentários de
  código (contexto pra manutenção), nunca em texto que o usuário vê.

**Investigação (mesma branch): por que não há dado de 2024/2025/2026 — e
por que isso não é corrigível só re-baixando o dado.** Confirmado em 3
fontes: (1) dump bruto baixado em 07/10/2026 (`data/raw/fontes.md`) só tem
2024 pra HPV, nenhuma das 5 vacinas do MVP; (2) o Anuário VacinaBR 2025 (a
publicação mais recente do próprio projeto) também só cobre até 2023; (3)
o PDF oficial de metodologia do VacinaBR (`metodologia_24-2.pdf`, seção
"Limitações") diz explicitamente que **a atualização da plataforma está sem
cronograma porque a disponibilização de dados de vacinação está
interrompida no TABNET/DataSUS** — não é atraso normal de consolidação, é
uma interrupção da fonte oficial que já dura pelo menos 2 anos (o PDF é de
out/2024; nosso dump de out/2026 confirma que continua interrompida). O
"2024" que aparece pra HPV é enganoso: a metodologia explica que o `ano` do
HPV não é ano de aplicação da dose, é o ano em que a coorte completa 15
anos — construído retroativamente com doses aplicadas até 2023, igual ao
resto. Ou seja, **não existe hoje nenhum dado publicamente disponível
depois de 2023 pra nenhuma das 5 vacinas**, em nenhuma fonte oficial
brasileira — não é uma falha da nossa coleta.
- **Decisão consequente:** como o modelo de risco (ver acima) foi treinado
  pra prever "o ano seguinte ao último dado disponível" e esse ano
  seguinte era 2024 quando construído, mas hoje (2026) já ficou pra trás
  sem nunca ter sido validado com dado real, os rótulos na UI foram
  trocados de "risco para 2024" pra "risco no próximo ano" (genérico), com
  nota explicando que a estimativa usa histórico até 2023 e que o
  Ministério da Saúde ainda não divulgou dado mais recente. Variáveis
  internas (`risco_2024`, `modelo_risco.json` etc.) mantiveram o nome —
  é só rótulo de UI que mudou, não a lógica do modelo.
- **Pendência em aberto (não implementada, decisão futura):** se/quando o
  TABNET voltar a publicar, o pipeline de 2014-2023 (notebooks 01-04) pode
  ser re-rodado do zero com o dado novo sem mudança de lógica — é só trocar
  `data/raw/vacinabr-dados-por-municipio.csv` e rodar os notebooks de novo.
  Não vale a pena tentar uma fonte alternativa (ex: TABNET/InfoMS direto)
  agora — seria um pipeline de coleta novo, com validação própria, fora do
  escopo atual.

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
- Dia 5 — nomes dos municípios: nunca tínhamos buscado o nome, só o `ibge6` (6
  dígitos). Fonte: API pública do IBGE
  (`servicodados.ibge.gov.br/api/v1/localidades/municipios`), que devolve código de
  7 dígitos (6 + dígito verificador). Confirmado empiricamente (notebook03,
  Etapa A, Passo 2) que `ibge6 == codigo_7_digitos[:6]` é 100% seguro — 0 casos de
  ambiguidade nos 5.571 municípios da API, e spot-check com 5 capitais bateu
  certinho. A API comprime a resposta com gzip mesmo sem pedir — precisa
  `gzip.decompress` manual antes do `json.loads`. Tabela salva em
  `data/raw/municipios_nomes.csv` (vai pro git, é pequena) e `nome_municipio`
  juntado em `clusters_municipios_mvp.csv` sem perder nenhuma das 5.570 linhas.
- Dia 5 — grafo de similaridade entre municípios (notebook03, Etapa B): k-NN graph
  com **K=5** vizinhos mais próximos por distância euclidiana nas 3 features de
  clustering padronizadas (mesmo `StandardScaler` em numpy puro do Dia 4). K=5
  escolhido por escopo (pequeno o bastante pra vizinhança local, grande o bastante
  pra não depender de 1 vizinho acidental) — não recalculado/testado como o K do
  KMeans. Distâncias calculadas em lotes de 500 municípios (evita montar a matriz
  5570×5570 inteira de uma vez). Arestas salvas em
  `data/processed/grafo_similaridade_arestas.csv`. `isolamento_similaridade`
  (distância média aos 5 vizinhos — quanto maior, mais atípico no espaço de
  features) juntado em `clusters_municipios_mvp.csv`. Os 30 municípios mais
  isolados concentram-se nos clusters "baixa, em recuperação" (17) e "queda e
  instável" (13) — **nenhum** no cluster "alta e estável", o que faz sentido
  porque esse cluster tem a menor variabilidade por definição.
- `networkx` instalado sem o problema do scipy/sklearn (lib pura Python, DLLs não
  bloqueadas pelo Device Guard). Pacotes `nbconvert`/`nbformat`/`nbclient` também
  instalados sem problema, usados pra executar o notebook via
  `python -m nbconvert --to notebook --execute --inplace` e gerar os outputs/PNGs
  reais em vez de deixar células sem execução.
- Dia 5 Parte 2 — definição de "queda atípica" (notebook03, z-score por ano):
  calculada a série "cobertura geral do município por ano" (mesma lógica do Dia 4
  Parte 1 — média de `cobertura_capada` entre as 5 vacinas, ignorando NaN) e o
  delta ano a ano (só entre anos consecutivos com os dois valores presentes, sem
  interpolar). O z-score de cada (município, ano) compara o delta daquele
  município com a média/desvio padrão do delta de TODOS os municípios **naquele
  mesmo ano** (não com o histórico do próprio município) — decisão deliberada pra
  neutralizar choques nacionais (ex: pandemia) e só destacar quem caiu muito mais
  que os pares no mesmo contexto. Limiar: **z < -2**. Resultado: 1.492 casos,
  salvos em `data/processed/destaques_quedas_atipicas.csv` (`ibge6`,
  `nome_municipio`, `uf`, `ano`, `delta`, `z_score`, `cluster`). Validação: anos de
  pandemia (2020-2022) ficaram com 32,6% dos casos, contra 33,3% esperado por
  distribuição uniforme entre os 9 anos — ou seja, a normalização por ano
  funcionou, a pandemia não domina os destaques.
- Escopo do grafo de similaridade (decisão confirmada no Dia 5 Parte 2): fica
  **só** como gráfico + `isolamento_similaridade` por enquanto. Detecção de
  comunidade no grafo e qualquer previsão baseada nele ficam fora do escopo dos
  5 dias — possível iteração futura do projeto, não implementar sem decisão
  explícita.
- Dia 5 Parte 3 — frase explicativa combinando os dois sinais (notebook03):
  cada destaque de queda atípica (Parte 2) é cruzado com `isolamento_similaridade`
  (Parte 1), convertido em **percentil dentro dos 5.570 municípios** (não só dos
  1.492 destaques — senão o percentil perderia o sentido de "comparado com o
  Brasil todo"). Regra: município no **top 10%** de isolamento (percentil >= 90)
  → frase aponta causa mais local/específica; caso contrário → frase aponta que
  pode ser um padrão mais amplo (os vizinhos do grafo também merecem olhar). O
  corte de 10% é deliberadamente mais permissivo que o top 30 (~0,5%) usado no
  gráfico da Parte 1 — aqui o objetivo é classificar cada destaque, não achar só
  os casos mais extremos. Função `gerar_frase()` monta a frase em português por
  linha. Tabela completa (1.492 casos + `nome_cluster`, `isolamento_similaridade`,
  `percentil_isolamento`, `frase`) salva em `data/processed/destaques_completo.csv`.
  Resultado: 387 casos (25,9%) caem em "isolado", 1.105 (74,1%) em "padrão mais
  amplo" — a maioria dos destaques tem vizinhos parecidos no grafo, então vale a
  pena checar se o mesmo problema aparece nos municípios próximos antes de tratar
  como caso único.
- Dia 6 — malha geográfica + dados por município pros 27 estados (generalizando o
  pipeline já validado pra Paraíba): geojson bruto de cada estado via
  `tbrugz/geodata-br` (`geojs-{codigo_ibg}-mun.json`) → topojson simplificado
  (`topojson-server`/`topojson-simplify`, tolerância 0.00005, igual ao de PB) →
  projeção Mercator (`d3-geo`) → paths SVG por município. Generalização em relação
  ao script original de PB: **tamanho do canvas agora é calculado por estado**
  (lado maior = 640px, lado menor proporcional à forma real do estado, medida
  projetando primeiro num quadrado grande e lendo o bounding box resultante) —
  em vez do `520×460` fixo original, que distorceria a proporção visual de
  estados muito alongados (ex: AM) ou muito compactos (ex: DF).
  - JSON de dados por município (`{uf}_municipios.json`) generalizado a partir dos
    CSVs já processados (`clusters_municipios_mvp.csv` + `serie_temporal_mvp.csv`),
    reproduzindo exatamente a estrutura do `pb_municipios.json` original (campo
    `todas` = média das 5 vacinas por `cobertura_capada`, ignorando NaN, igual à
    regra do Dia 4 Parte 1; buracos ficam `null`, não são preenchidos/interpolados).
  - **Limitação conhecida da fonte `geodata-br`**: 6 dos 5.570 municípios não têm
    geometria na malha (ficam sem forma clicável no mapa, mas continuam presentes
    nos dados/ranking/busca): Paraíso das Águas (MS), Mojuí dos Campos (PA),
    Nazária (PI), Pinto Bandeira (RS), Pescaria Brava (SC), Balneário Rincão (SC).
    Os 6 são municípios criados por desmembramento relativamente recente — a malha
    da `geodata-br` nunca foi atualizada pra incluí-los. Verificado comparando o
    `id` (código IBGE de 7 dígitos) de cada feature geográfica contra o `ibge6` dos
    dados — 5.564 de 5.570 batem perfeitamente. Decisão: documentar e seguir (não
    é prioridade do MVP buscar uma malha alternativa só pra esses 6).
- Dia 6 Parte 1 — resumo por estado (`data/processed/resumo_estados.json`, 27
  linhas, `notebooks/gerar_resumo_estados.py`): mapa nacional colore por
  **cobertura média do estado** (mesma escala contínua vermelho/amarelo/verde
  usada no drill-down por município), não pelo cluster — decisão explícita pra
  manter uma única linguagem visual de cor em todo o app. Cluster predominante
  (moda entre os municípios do estado) e tendência média viram metadado exibido
  ao selecionar o estado (tooltip/painel), sem afetar a cor do mapa.
- Dia 6 Parte 1b — série nacional por ano/vacina
  (`data/processed/serie_nacional.json`, `notebooks/gerar_serie_nacional.py`):
  média de `cobertura_capada` por (ano, imunizante) em todo o Brasil, mesma
  metodologia do Dia 3 Parte 4 e do "todas" do Dia 4 Parte 1, só que agregada em
  nível nacional. Alimenta o mini-gráfico "evolução nacional" que fica visível
  em toda vista do app (nacional e dentro de um estado) — não existia como
  arquivo antes, só como PNG estático do Dia 3.
- Dia 6 Parte 2 — frontend real em `frontend/` (Vite + React + TypeScript):
  - Gerenciamento de estado: **Zustand** (`frontend/src/store/useAppStore.ts`),
    não Context+useReducer — escolha do usuário entre as duas opções
    apresentadas.
  - Navegação nacional ↔ estado: **breadcrumb** ("Brasil / [Estado]"), não o
    padrão de abas fixas do protótipo (`design-reference/template2.html`), já
    que agora os 27 estados têm dado real (o protótipo só tinha Paraíba) e não
    caberiam como abas.
  - **Atualização:** decisão de "sem roteamento" revertida — o usuário pediu
    URL navegável por estado/município (compartilhável, com voltar/avançar do
    navegador). Agora usa react-router: `/`, `/:uf` (ex: `/PB`),
    `/:uf/:municipio` (código IBGE de 7 dígitos, ex: `/PB/2501006` —
    convertido pro `ibge6` interno via `.slice(0,6)`). Vacina/ano viram query
    params (`?vacina=bcg&ano=2019`) com `replace:true` (escolha do usuário
    entre as duas opções apresentadas) — assim trocar filtro não polui o
    histórico, só a navegação entre estado/município empilha. A URL passou a
    ser a fonte única de verdade pra navegação; o Zustand ficou só com o
    cache de dados por estado e o estado do boot. Fallback de SPA adicionado
    pra produção (`frontend/public/_redirects` e `frontend/vercel.json`),
    senão um link direto pra `/PB/2501006` dá 404 no host estático.
  - Carregamento sob demanda: `brazil-states-paths.json` + `resumo_estados.json`
    + `serie_nacional.json` carregam no boot (pequenos); o par
    `{UF}-mun-paths.json` + `{UF}_municipios.json` de cada estado só é buscado
    (`fetch`) quando o estado é clicado, e fica cacheado em memória pro resto da
    sessão.
  - `data/processed/` é a fonte única de verdade; `frontend/public/data/` é uma
    cópia de build gerada por `frontend/scripts/sync-data.mjs` (rodado via
    `predev`/`prebuild` no `package.json`) e fica no `.gitignore` do frontend —
    não duplica os ~20MB de JSON no git.
  - Testado de ponta a ponta no navegador (Chrome, via `npm run dev`): drill-down
    nacional → estado → município, filtro de vacina/ano, busca e clique na
    tabela de ranking, breadcrumb de volta — tudo sincronizado, sem erros no
    console.
- Dia 6 Parte 3 — ajustes pós-revisão (roteamento, cor, zoom, animação):
  - **Faixas de cor recalibradas**: `<65% / 65–80% / 80–88% / 88%+` (eram
    `<70/85/95`). Motivo: os cortes originais foram pensados pra um valor
    pontual (município/vacina/ano, que vai de ~33% a ~100%), mas o mapa
    nacional usa média agregada de 5.570 municípios, comprimida numa faixa
    bem mais estreita (estados vão de 58,7% a 88,8%) — com os cortes
    antigos, 21 dos 27 estados caíam na mesma faixa "laranja" (verificado
    contando a distribuição real antes de mudar qualquer número). Opção
    escolhida entre 3 apresentadas (recalibrar cortes fixos / colorir por
    `meta_atingida` / escala contínua): recalibrar cortes fixos, mantendo
    cobertura média como critério e a mesma lógica compartilhada com a
    coluna "Situação" da tabela. `meta_atingida` como critério foi
    descartado porque, testado nos dados reais, deslocava o problema (quase
    todo o Brasil cairia no vermelho sob os cortes antigos) em vez de
    resolvê-lo.
  - **Zoom até o município**: ao clicar num município (mapa ou tabela), o
    mapa também dá zoom/pan pra focar nele (não só nacional→estado). Cálculo
    geométrico real via `getBBox()` do `<path>` SVG selecionado, convertido
    pra pixels considerando o letterboxing do `viewBox` (`preserveAspectRatio`
    padrão `xMidYMid meet`) — não é só um valor fixo de zoom.
  - **Transição de nível**: pop-in CSS (`@keyframes mapZoomIn`, 220ms) ao
    trocar entre nacional/estado/outro estado (remonta via `key` do React).
    O zoom até um município dentro do mesmo estado usa a `transition` já
    existente no `.zoom-stage` (mesmo elemento, só muda `transform`), não
    essa animação de remount. Sem lib de animação — CSS puro foi suficiente
    pro efeito pedido ("nada exagerado"). Respeita
    `prefers-reduced-motion: reduce`.
  - **Roteamento por URL** (ver acima, "Atualização") e fallback de SPA pra
    produção.
- Dia 6 Parte 4 — redesign visual em branch separada (`redesign`, a partir da
  main, sem merge ainda): direção editorial/infográfico (banner, tipografia
  serifada, callouts) em vez do visual de dashboard original. Só
  layout/tipografia/composição mudou — arquitetura de dados, carregamento sob
  demanda, Zustand, roteamento e lógica de filtro/busca não foram
  reescritos. Paleta de cor do semáforo (crítico/baixa/próxima da
  meta/na meta) e `--accent` não mudaram, só os tons neutros (papel/tinta
  mais quentes) — a referência visual usa azul pra "baixa cobertura", o que
  quebrava a convenção de semáforo já decidida, então as cores da
  referência não foram copiadas, só a composição.
  - **Fonte da UF "em destaque"**: `n_destaques` (contagem de linhas de
    `data/processed/destaques_completo.csv` por `uf`) foi adicionado ao
    `resumo_estados.json` via `notebooks/gerar_resumo_estados.py` —
    reaproveita o sinal de queda atípica do Dia 5 em vez de uma métrica nova.
  - **Callouts editoriais (`frontend/src/components/Callouts.tsx`) são
    contextuais ao hover, não fixos**: passar o mouse sobre um estado no
    mapa nacional mostra um card só (cobertura média, tendência — slope de
    regressão do Dia 4, não delta literal do último ano —, situação vs. meta
    de 88% e `n_destaques`) com linha-guia até o estado; sem hover, nenhum
    card aparece. O card flutua (`position:absolute`, calculado em JS) em
    vez de reservar coluna fixa no layout — uma coluna sempre reservada
    (mesmo vazia) foi o que deixava o mapa nacional pequeno demais numa
    iteração intermediária. O lado esquerda/direita segue a posição do
    estado no mapa. Gatilho é hover (não click), porque clicar num estado já
    navega pra página do estado. Tooltip antigo do mapa nacional foi
    removido (ficava redundante/sobreposto ao callout) — estado/município
    mantêm o tooltip original.
  - **Donut → meter**: a skill de dataviz marca donut/pie pra comparar
    valores próximos como anti-padrão explícito (as 5 vacinas ficam entre
    ~88–93% em 2023), e recomenda "Meter" (anel de progresso de UM valor só)
    pra "uma razão única contra um limite" — por isso o rodapé nacional
    (`NationalFooter.tsx`) usa 5 anéis de progresso individuais, não um
    gráfico de pizza/donut categórico.
  - **Filtro nacional virou barra horizontal** (`NationalToolbar.tsx`,
    só vacina + link pra tabela) em vez da coluna lateral de 300px
    (`StageIntro`), que agora só é usada em estado/município — libera
    largura pro mapa nacional, que é maior que o de estado/município por
    decisão explícita (card central da tela), mas sem exagerar (ficou
    grande demais numa iteração anterior e foi recalibrado pra baixo).
  - **Imagem de fundo do Hero** (`frontend/public/images/hero-bg.jpg`, não
    versionada): `.hero-banner` no CSS usa 3 camadas — véu escuro (sempre) >
    foto (só aparece se o arquivo existir) > gradiente CSS (fallback,
    `background-image` com 404 fica transparente na camada, não derruba a
    seguinte). Pra trocar o placeholder pela foto final, só salvar o
    arquivo nesse caminho, nada mais muda.
  - Self-QA visual feito no Chrome (`npm run dev`) em cada rodada de ajuste:
    nacional (hover em estados dos dois lados do mapa, sem hover), estado,
    município, filtro de ano/vacina, busca, zoom de município, navegação por
    URL e botão voltar — sem regressão.

- **Extensão da série para 2024-2026 a partir do microdado do PNI** (decisão
  tomada depois da investigação que mostrou o VacinaBR parado em 2023, ver
  acima). O VacinaBR não publica mais, mas o **microdado bruto do PNI continua
  sendo publicado** em dadosabertos.saude.gov.br (um ZIP de CSV por mês, ~2 GB
  cada), assim como o SINASC. Então a cobertura de 2024-2026 foi **reconstruída
  do zero** com a mesma fórmula do VacinaBR: doses aplicadas ÷ nascidos vivos.
  - **Etapa 0 (validação, antes de gerar qualquer dado):** reconstruiu-se 2023,
    ano que já conhecemos, pra medir se a metodologia bate. Resultado:
    correlação de 0,90 a 0,975 com o dado do VacinaBR, mediana de 3,4 p.p. de
    diferença. Pentavalente (razão 1,033) e Poliomielite (1,011) bateram quase
    exatamente; BCG (1,072) e Hepatite B (1,080) vieram inflados.
  - **Diagnóstico do viés:** o erro estava na regra de dose, não no
    denominador (o SINASC reproduziu o denominador do VacinaBR com 0,002% de
    erro na Tríplice e 0,22% nas outras). Investigando dez/2023 com
    `co_paciente` e `ds_origem_registro`, confirmou-se **dupla contagem**: a
    mesma dose aparece como registro original E como "transcrição de
    caderneta". Atingia 4,8% das doses de BCG e 5,2% de HepB (em ~60% dos
    casos com transcrição envolvida), e apenas 1,0% da Tríplice Viral.
  - **Dedup conservadora (decisão):** a chave é (`co_paciente`, `dt_vacina`,
    `ds_tipo_dose`) — mesma pessoa, mesma data, mesmo tipo de dose. Testou-se
    também uma dedup agressiva (1 paciente = no máximo 1 dose), mas ela
    **passa do ponto**: levava BCG/HepB de +7% pra -5%, trocando um viés por
    outro. Com a conservadora, as 5 vacinas caem pra 1,013-1,024, dentro da
    faixa onde Penta/Pólio já estavam sem correção nenhuma.
  - A dedup é aplicada sobre o **ano inteiro**, não mês a mês, pra capturar
    duplicata entre meses diferentes. Como o `hash()` nativo do Python é
    randomizado por processo, a chave usa `pd.util.hash_pandas_object`, que é
    determinístico — sem isso a dedup entre arquivos processados em paralelo
    não funcionaria.
  - Mapeamento fechado (microdado → nossas 5 vacinas): `BCG`, `HB`,
    `Penta` + `Hexa acelular`, `VIP`, `SCR`. **`Penta acelular` fica de fora**
    porque é DTPa/VIP/Hib, sem hepatite B — não tem os 5 componentes que a
    metodologia do VacinaBR exige. Município = `co_municipio_paciente`
    (residência, igual ao painel InfoMS que o VacinaBR usou), não
    estabelecimento — 15,6% das doses divergem entre os dois. Todas as
    estratégias de vacinação entram, e transcrição de caderneta também.
  - **Limitação sem solução — Hepatite B:** o microdado só tem idade em anos
    inteiros, então não dá pra isolar "0 a 30 dias". A aproximação usada é
    HepB + idade 0 + primeira dose, que inclui qualquer dose no primeiro ano
    de vida. É a vacina com maior viés residual, e isso não é corrigível com
    essa fonte.
  - **2026 é ano PARCIAL — jan a ago, 8 meses.** O PNI publicou até setembro,
    mas o SINASC 2026 (2ª prévia) só vai até agosto; usar 9 meses de doses
    contra 8 de nascidos vivos inflaria a cobertura ~12% por puro
    descasamento, então o numerador foi cortado em agosto. Mesmo alinhado,
    **2026 não é comparável a um ano completo**: a Tríplice Viral de 2026 sai
    em ~64% porque o numerador tem 8 meses de doses mas o denominador é a
    coorte inteira nascida em 2025, e Penta/Pólio ficam subestimadas porque
    bebês nascidos no fim da janela ainda não tiveram tempo de completar o
    esquema de 3 doses.
  - **Arquivos (o original NÃO foi alterado):**
    - `data/processed/cobertura_mvp_2014_2023.csv` — intocado, fonte VacinaBR.
    - `data/processed/cobertura_reconstruida_pni_2024_2026.csv` (83.552
      linhas) — só os anos novos.
    - `data/processed/cobertura_mvp_2014_2026.csv` (357.084 linhas) — a junção
      dos dois, que é o que o resto do pipeline deve passar a consumir.
    - Todos os três têm a coluna **`fonte`** (`vacinabr` vs `pni_reconstruido`)
      e as colunas `meses_dado_numerador`, `meses_dado_denominador` e
      `ano_parcial`, pra que o frontend possa sinalizar dado estimado e ano
      incompleto. **Qualquer visualização que inclua 2024-2026 precisa
      mostrar essa distinção** — não é o mesmo dado que 2014-2023.
  - Taxa de duplicata removida na prática: 2024 e 2025 ficaram em 2,9% do
    total (BCG -5,1%/-5,4%, HepB -5,3%, Penta ~-1,3%, Pólio ~-1,0%, Tríplice
    ~-0,7%), batendo com o que o diagnóstico de dez/2023 previu. **2026 removeu
    só 0,5%** — sinal de que as transcrições de caderneta ainda não foram
    lançadas; ou seja, o dado de 2026 ainda vai mudar conforme o registro se
    completa.
  - **Scripts do pipeline** (em `notebooks/`, pra que 2024-2026 seja
    reproduzível): `pni_capturar_mes.py` (baixa e filtra um mês, gravando as
    chaves de dedup), `pni_sinasc_anos.py` (denominador + relatório de
    completude mensal) e `pni_montar_cobertura.py` (dedup anual + geração dos
    CSVs finais). O capturador roda um mês por vez, e vários em paralelo é só
    disparar vários processos.
  - Operacional: ~70 GB de download (33 meses). Os ZIPs são lidos em
    streaming, descomprimindo o deflate na memória sem gravar os ~280 GB
    descompactados em disco. O gargalo é CPU (parsing), não rede — com 8
    processos paralelos o pipeline inteiro leva ~1h. **O S3 derruba conexão de
    vez em quando** (`ConnectionResetError`): sem retentativa um mês some
    silenciosamente e o total anual sai errado sem nenhum aviso, então o
    capturador tem 4 tentativas com espera progressiva.

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
Dia 5 Destaques ✅ concluído (`notebooks/notebook03_destaques.ipynb`) — Parte 1:
nomes dos municípios via API do IBGE + grafo de similaridade k-NN (K=5) com
`isolamento_similaridade` em `data/processed/clusters_municipios_mvp.csv`. Parte 2:
queda atípica por z-score calculado por ano (limiar z < -2), 1.492 casos em
`data/processed/destaques_quedas_atipicas.csv`. Parte 3: frase explicativa
combinando os dois sinais (perfil isolado vs. padrão mais amplo), tabela final em
`data/processed/destaques_completo.csv` (ver detalhes de cada parte acima) |
Dia 6 Frontend ✅ concluído — app React (Vite+TS) com Zustand, roteamento por
URL (`/`, `/:uf`, `/:uf/:municipio`), drill-down Brasil→estado→município com
zoom e animação de transição, filtro de vacina/ano, busca e ranking; redesign
editorial aprovado e mergeado na main (ver detalhes acima: callouts
contextuais no hover do mapa nacional, header com imagem de fundo, anéis de
progresso por vacina no rodapé nacional) | Dia 7 Deploy