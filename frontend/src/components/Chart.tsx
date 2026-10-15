import { useAppStore } from "../store/useAppStore";
import { useFiltros } from "../hooks/useFiltros";
import { VACINA_LABELS } from "../types/data";
import { fmtPct } from "../utils/format";

export function Chart() {
  const serieNacional = useAppStore((s) => s.serieNacional);
  const { vacina } = useFiltros();

  if (!serieNacional) return null;

  const years = serieNacional.years;
  const series = years.map((y) => serieNacional.brasil[String(y)][vacina]);
  const min = Math.min(...series);
  const max = Math.max(...series);
  const padLo = Math.max(0, Math.floor((min - 4) / 5) * 5);
  const padHi = Math.min(100, Math.ceil((max + 4) / 5) * 5);

  const W = 230,
    H = 120,
    L = 26,
    R = 6,
    T = 10,
    B = 18;
  const pw = W - L - R,
    ph = H - T - B;
  const x = (i: number) => L + i * (pw / (years.length - 1));
  const y = (v: number) => T + ((padHi - v) / (padHi - padLo)) * ph;

  const areaPts = series.map((v, i) => `${x(i)},${y(v)}`).join(" L ");
  const linePts = areaPts;
  const minIdx = series.indexOf(min);
  const lastIdx = series.length - 1;

  return (
    <div className="chart-wrap">
      <div className="chart-title">
        Evolução nacional — {VACINA_LABELS[vacina].toLowerCase()}
      </div>
      <svg viewBox="0 0 230 120" width="100%" height="120">
        {[padLo, padHi].map((gv) => (
          <g key={gv}>
            <line x1={L} y1={y(gv)} x2={W - R} y2={y(gv)} stroke="#DCE7F0" strokeWidth={1} />
            <text x={L - 5} y={y(gv) + 3} textAnchor="end" fontSize={8} fill="#93A7B8">
              {Math.round(gv)}%
            </text>
          </g>
        ))}
        <path
          d={`M ${areaPts} L ${x(years.length - 1)},${T + ph} L ${x(0)},${T + ph} Z`}
          fill="#1B5FA8"
          fillOpacity={0.08}
          stroke="none"
        />
        <path
          d={`M ${linePts}`}
          fill="none"
          stroke="#1B5FA8"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(minIdx)} cy={y(min)} r={3} fill="#B91C1C" stroke="#fff" strokeWidth={1.3} />
        <circle
          cx={x(lastIdx)}
          cy={y(series[lastIdx])}
          r={3}
          fill="#157347"
          stroke="#fff"
          strokeWidth={1.3}
        />
        <text
          x={x(lastIdx) - 3}
          y={y(series[lastIdx]) - 7}
          textAnchor="end"
          fontSize={8.5}
          fontWeight={700}
          fill="#157347"
        >
          {fmtPct(series[lastIdx])}
        </text>
        <text x={x(0)} y={H - 3} textAnchor="start" fontSize={8} fill="#93A7B8">
          {years[0]}
        </text>
        <text x={x(years.length - 1)} y={H - 3} textAnchor="end" fontSize={8} fill="#93A7B8">
          {years[years.length - 1]}
        </text>
      </svg>
    </div>
  );
}
