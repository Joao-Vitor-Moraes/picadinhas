# Imuniza Brasil

Como a vacinação dos municípios brasileiros está evoluindo, e quais municípios
apresentam padrões que merecem atenção?

## Escopo do MVP
- Vacinas: BCG, Poliomielite, Pentavalente, Tríplice viral, Hepatite B
- Período: últimos 10 anos disponíveis
- Mapa por estado + ranking/busca por município
- Fora do escopo por agora: previsão, cruzamento socioeconômico, mapa municipal completo

Utilização de dados de saúde pública, não faz diagnóstico nem recomendação médica.

## Como rodar

O app principal (mapa, ranking, filtros) é 100% estático — só o frontend.
A branch `grafo-comunidades` adiciona um backend opcional pro painel de rede
de similaridade entre municípios.

**Frontend** (sempre necessário — ver `frontend/README.md` pra detalhes):
```
cd frontend
npm install
npm run dev
```
Abre em `http://localhost:5173`.

**Backend** (só necessário na branch `grafo-comunidades`, pro painel "Rede de
similaridade" na view de município — ver `backend/main.py`):
```
.venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000
```
Espera aparecer `Application startup complete` (carrega o grafo e roda a
detecção de comunidades uma vez). Precisa rodar antes/junto do frontend.