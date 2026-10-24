import type { VacinaKey } from "../types/data";

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

// Risco de queda brusca de cobertura, previsto por um modelo treinado sobre
// o histórico de cada município (ver CLAUDE.md). O modelo nunca é
// retreinado, mas o ANO-ALVO da previsão muda conforme mais anos reais vão
// ficando disponíveis — por isso o ano vem sempre de `riscoResumo.ano_alvo_previsao`
// (boot) em vez de fixo no texto. Reaproveita a paleta de semáforo já usada
// pra cobertura (--good/--low/--crit) em vez de inventar cores novas.
export type RiscoFaixa = "baixo" | "medio" | "alto";

export function riscoTexto(faixa: RiscoFaixa | null | undefined): string {
  if (!faixa) return "—";
  return { baixo: "Baixo", medio: "Médio", alto: "Alto" }[faixa];
}

export function riscoCor(faixa: RiscoFaixa | null | undefined): string {
  if (!faixa) return "var(--ink-faint)";
  return { baixo: "var(--good)", medio: "var(--low)", alto: "var(--crit)" }[faixa];
}

// Dia 8 Parte 1: a previsão de risco passou a usar o último ano DISPONÍVEL
// como base (em vez de esperar o último ano CHEIO fechar — ver CLAUDE.md),
// então o ano-base pode ser parcial. O ano-base é sempre
// `ano_alvo_previsao - 1` (nunca fixo em "2026" — isso avança sozinho pros
// próximos anos), e se ELE é parcial já está disponível em
// `serieNacional.brasil[anoBase].ano_parcial` (mesmo campo que o selo de
// cobertura já usa) — não precisa de nenhum dado novo gerado pelo pipeline.
export function riscoBaseParcial(
  anoAlvoPrevisao: number | null | undefined,
  serieNacional: { brasil: Record<string, { ano_parcial: boolean }> } | null | undefined,
): { anoBase: number; parcial: boolean } | null {
  if (!anoAlvoPrevisao) return null;
  const anoBase = anoAlvoPrevisao - 1;
  const parcial = serieNacional?.brasil[String(anoBase)]?.ano_parcial ?? false;
  return { anoBase, parcial };
}

export function textoSeloRiscoParcial(anoBase: number): string {
  return (
    `Como ${anoBase} ainda não terminou, essa previsão pode estar um ` +
    "pouco mais alta do que a realidade."
  );
}

// Selo de proveniência (Parte 2 da extensão pro PNI, ver CLAUDE.md): zero
// jargão técnico visível (nada de "PNI", "SINASC" ou "dedup" no texto que o
// usuário lê — só em comentário de código).
export type FonteDado = "vacinabr" | "pni_reconstruido";

export function ehDadoEstimado(fonte: FonteDado | string | null | undefined): boolean {
  return fonte === "pni_reconstruido";
}

export const TEXTO_SELO_FONTE =
  "A partir de 2024 usamos outra base pública do governo, porque a fonte " +
  "original ainda não reuniu esses anos. Os números passam por um ajuste " +
  "pra ficarem comparáveis, mas têm uma margem de erro um pouco maior que " +
  "os anos anteriores.";

export const TEXTO_SELO_2026_PARCIAL =
  "2026 ainda não terminou — esses números cobrem só uma parte do ano, não " +
  "dá pra comparar diretamente com um ano completo.";

// 2026 é parcial (8 meses) e distorce estruturalmente estas 3 vacinas (ver
// CLAUDE.md): a Tríplice Viral é medida sobre a coorte de 1 ano inteira, mas
// só 8 meses de dose entram no numerador (sai baixa demais); Penta/Pólio
// dependem do esquema de 3 doses completo — crianças nascidas no fim do
// período ainda não tiveram tempo de tomar todas.
export const AVISO_2026_POR_VACINA: Partial<Record<VacinaKey, string>> = {
  triplice:
    "Essa vacina é medida em crianças que completaram 1 ano — com só 8 meses " +
    "de 2026 registrados, esse número sai artificialmente baixo.",
  penta:
    "Com só 8 meses de 2026 registrados, algumas crianças nascidas no fim " +
    "desse período ainda não tiveram tempo de tomar as 3 doses — esse número " +
    "tende a ficar abaixo do real.",
  polio:
    "Com só 8 meses de 2026 registrados, algumas crianças nascidas no fim " +
    "desse período ainda não tiveram tempo de tomar as 3 doses — esse número " +
    "tende a ficar abaixo do real.",
};
