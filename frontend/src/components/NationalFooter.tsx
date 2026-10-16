import { useAppStore } from "../store/useAppStore";
import { VACINA_LABELS, type VacinaKey } from "../types/data";
import { colorFor, fmtPct } from "../utils/format";

// Rodape editorial, so na visao nacional (ver CLAUDE.md, Dia 6 Parte 3 /
// redesign): a referencia (design-reference/redesign-ref.png) usa uma
// fileira de donuts por vacina, mas a skill de dataviz marca donut/pie pra
// comparar valores proximos como anti-padrao explicito ("donut stays
// deprioritized" / "a donut/pie for comparing close values") — exatamente
// o caso aqui (as 5 vacinas ficam entre ~88% e ~93% em 2023). O componente
// recomendado pra "uma razao unica contra um limite" e o Meter (mesma
// rampa de cor), por isso cada "donut" da referencia virou um anel de
// progresso de UM valor so (nao um grafico de pizza com fatias por
// categoria) — mantem a leitura circular da referencia sem reproduzir o
// anti-padrao.
const VACINAS_METER: VacinaKey[] = ["bcg", "hepb", "penta", "polio", "triplice"];
const N_MUNICIPIOS = 5570;

export function NationalFooter() {
  const serieNacional = useAppStore((s) => s.serieNacional);
  if (!serieNacional) return null;

  const ultimoAno = serieNacional.years[serieNacional.years.length - 1];
  const valores = serieNacional.brasil[String(ultimoAno)];

  return (
    <div className="national-footer">
      <div className="footer-people">
        <div className="footer-people-icons" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <PersonIcon key={i} tone={i % 5} />
          ))}
        </div>
        <div className="footer-people-num num">{N_MUNICIPIOS.toLocaleString("pt-BR")}</div>
        <div className="footer-people-cap">
          municípios com dados
          <br />
          de cobertura vacinal.
        </div>
      </div>

      <div className="footer-meters">
        {VACINAS_METER.map((v) => (
          <Meter key={v} label={VACINA_LABELS[v]} value={valores[v]} />
        ))}
      </div>

      <div className="footer-source">
        Dados do VacinaBR
        <br />
        Atualizado em {ultimoAno}
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c * (1 - pct / 100);
  const cor = colorFor(value);

  return (
    <div className="meter">
      <svg className="meter-ring" width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
        />
        <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight={700} fill="var(--ink)">
          {Math.round(value)}%
        </text>
      </svg>
      <div className="meter-label">{label}</div>
    </div>
  );
}

const TONES = ["var(--ink)", "var(--high)", "var(--good)", "var(--accent)", "var(--low)"];

function PersonIcon({ tone }: { tone: number }) {
  return (
    <svg width="14" height="22" viewBox="0 0 14 22" fill={TONES[tone % TONES.length]}>
      <circle cx="7" cy="4.5" r="4.5" />
      <path d="M0 21c0-5.5 3.1-9 7-9s7 3.5 7 9z" />
    </svg>
  );
}
