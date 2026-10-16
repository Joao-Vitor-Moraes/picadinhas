// Banner editorial, so da visao nacional (ver CLAUDE.md, Dia 6 Parte 3 /
// redesign). O fundo e definido via CSS em `.hero-banner` (index.css), em
// camadas: veu escuro (sempre) > foto (so aparece quando o arquivo
// existir) > gradiente (placeholder/fallback enquanto nao existir). PARA
// TROCAR O PLACEHOLDER PELA FOTO FINAL: salve o arquivo em
// frontend/public/images/hero-bg.jpg (crie a pasta se nao existir) — nada
// precisa mudar aqui nem no CSS, a foto substitui o gradiente sozinha.
export function Hero() {
  return (
    <div className="hero-banner">
      <svg
        className="hero-map-mark"
        viewBox="0 0 640 600"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="320" cy="300" r="260" />
      </svg>
      <div className="hero-content">
        <h1 className="hero-title">Cobertura vacinal no Brasil</h1>
        <p className="hero-subtitle">
          Como a cobertura vacinal dos municípios brasileiros está evoluindo, e quais
          municípios merecem atenção.
        </p>
        <span className="hero-rule" />
      </div>
    </div>
  );
}
