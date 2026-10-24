import { useSearchParams } from "react-router-dom";
import type { VacinaKey } from "../types/data";
import type { StatusWord } from "../utils/format";

const VACINA_PADRAO: VacinaKey = "todas";
const ANO_PADRAO = "2023";
const FAIXAS_VALIDAS: StatusWord[] = ["bad", "warn", "near", "ok"];

function parseFaixas(param: string | null): Set<StatusWord> {
  if (!param) return new Set();
  const validas = param
    .split(",")
    .filter((f): f is StatusWord => (FAIXAS_VALIDAS as string[]).includes(f));
  return new Set(validas);
}

export function useFiltros() {
  const [searchParams, setSearchParams] = useSearchParams();

  const vacina = (searchParams.get("vacina") as VacinaKey) || VACINA_PADRAO;
  const ano = searchParams.get("ano") || ANO_PADRAO;
  // Filtro de faixa de cobertura (sugestao de amigo, Dia 8 Parte 2): reaproveita
  // as 4 faixas do semaforo ja definidas em utils/format.ts (StatusWord) em vez
  // de inventar um corte novo. URL e a fonte unica de verdade (mesmo padrao de
  // vacina/ano, com replace:true) -- nenhuma faixa marcada = tudo visivel
  // (comportamento atual preservado).
  const faixasAtivas = parseFaixas(searchParams.get("faixa"));

  function setVacina(v: VacinaKey) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("vacina", v);
        return next;
      },
      { replace: true },
    );
  }

  function setAno(a: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("ano", a);
        return next;
      },
      { replace: true },
    );
  }

  function toggleFaixa(f: StatusWord) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const atuais = parseFaixas(prev.get("faixa"));
        if (atuais.has(f)) atuais.delete(f);
        else atuais.add(f);
        if (atuais.size === 0) next.delete("faixa");
        else next.set("faixa", Array.from(atuais).join(","));
        return next;
      },
      { replace: true },
    );
  }

  function limparFaixas() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("faixa");
        return next;
      },
      { replace: true },
    );
  }

  return { vacina, ano, setVacina, setAno, faixasAtivas, toggleFaixa, limparFaixas, searchParams };
}
