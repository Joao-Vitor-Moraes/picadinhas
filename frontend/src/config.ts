// URL base do backend (ver backend/main.py). Local por padrao (`uvicorn
// backend.main:app --port 8000`); sobrescreva com VITE_API_BASE_URL quando a
// hospedagem do backend for decidida (Dia 7).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
