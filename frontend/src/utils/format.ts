export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (
    v.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%"
  );
}

// Cortes recalibrados (Dia 6, ajuste) com base na distribuicao real dos
// dados: os cortes originais (70/85/95) foram calibrados pensando num valor
// pontual (um municipio/vacina/ano, que vai de ~33% a ~100%), mas o mapa
// nacional usa media agregada de 5.570 municipios, que fica comprimida numa
// faixa bem mais estreita (estados vao de 58,7% a 88,8%) — por isso quase
// todo o Brasil caia na mesma faixa "laranja" com os cortes antigos.
export const CORTE_BAIXO = 65;
export const CORTE_MEDIO = 80;
export const CORTE_ALTO = 88;

export function colorFor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "#D7E3EC";
  if (v < CORTE_BAIXO) return "#B91C1C";
  if (v < CORTE_MEDIO) return "#E8920D";
  if (v < CORTE_ALTO) return "#52A675";
  return "#157347";
}

export type StatusWord = "bad" | "warn" | "near" | "ok";

export function statusWord(v: number | null | undefined): StatusWord | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  if (v < CORTE_BAIXO) return "bad";
  if (v < CORTE_MEDIO) return "warn";
  if (v < CORTE_ALTO) return "near";
  return "ok";
}

export function statusText(w: StatusWord | null): string {
  if (!w) return "—";
  return { bad: "Crítico", warn: "Baixa cobertura", near: "Próximo da meta", ok: "Na meta" }[w];
}
