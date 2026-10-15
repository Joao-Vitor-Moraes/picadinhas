# Picadinhas — frontend

Vite + React + TypeScript. Sem backend — o app só lê os JSONs já processados
pelo pipeline Python (ver `../CLAUDE.md` na raiz do repo pro contexto completo
do projeto).

## Rodando localmente

```
npm install
npm run dev
```

`predev`/`prebuild` copiam automaticamente os JSONs de `../data/processed/`
pra `public/data/` (ver `scripts/sync-data.mjs`) — rode `npm run sync-data`
manualmente se os notebooks gerarem dados novos enquanto o `dev` já está no ar.

## Arquitetura

- **Roteamento (react-router):** a URL é a fonte única de verdade pra
  navegação — `/`, `/:uf` (ex: `/PB`), `/:uf/:municipio` (código IBGE de 7
  dígitos, ex: `/PB/2501006`, convertido pro `ibge6` interno via
  `useRota()` em `src/hooks/useRota.ts`). Filtro de vacina/ano vira query
  param (`?vacina=bcg&ano=2019`) via `src/hooks/useFiltros.ts`, usando
  `replace:true` pra não poluir o histórico — voltar/avançar do navegador
  navega entre estado/município, não entre trocas de filtro.
- **Estado no Zustand** (`src/store/useAppStore.ts`) fica só com o que não é
  "em que página eu tô": dados do boot, e o cache de dados por estado
  (`ufCache`) buscado sob demanda (`ensureUF`) quando a URL muda pra um
  estado novo.
- `brazil-states-paths.json` + `resumo_estados.json` + `serie_nacional.json`
  carregam no boot (pequenos). O par `{UF}-mun-paths.json` +
  `{UF}_municipios.json` de cada estado só é buscado quando a URL aponta
  pra aquele estado, e fica cacheado em memória.
- **Zoom:** drill-down nacional→estado→volta usa um pop-in CSS
  (`.map-level-enter`, remonta ao trocar de nível). Zoom até um município
  dentro do estado é geométrico (bbox real do `<path>` via `getBBox()`,
  convertido pra pixels considerando o letterboxing do `viewBox`), suavizado
  pela mesma `transition` do `.zoom-stage`. Ambos respeitam
  `prefers-reduced-motion`.
- Faixas de cor do mapa (`colorFor`/`statusWord` em `src/utils/format.ts`):
  recalibradas pra `<65% / 65–80% / 80–88% / 88%+` com base na distribuição
  real dos dados (os cortes originais 70/85/95 foram pensados pra um valor
  pontual; a média agregada por estado fica comprimida numa faixa bem mais
  estreita, 58,7%–88,8%, e quase tudo caía na mesma faixa).
- Pra rotas funcionarem em produção (host estático), tem fallback de SPA em
  `public/_redirects` (Netlify) e `vercel.json` (Vercel) — sem isso, um link
  direto tipo `/PB/2501006` dá 404 no servidor.
