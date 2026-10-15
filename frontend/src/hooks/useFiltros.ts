import { useSearchParams } from "react-router-dom";
import type { VacinaKey } from "../types/data";

const VACINA_PADRAO: VacinaKey = "todas";
const ANO_PADRAO = "2023";

export function useFiltros() {
  const [searchParams, setSearchParams] = useSearchParams();

  const vacina = (searchParams.get("vacina") as VacinaKey) || VACINA_PADRAO;
  const ano = searchParams.get("ano") || ANO_PADRAO;

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

  return { vacina, ano, setVacina, setAno, searchParams };
}
