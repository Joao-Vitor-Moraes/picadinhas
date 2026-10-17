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