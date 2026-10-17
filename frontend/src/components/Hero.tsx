// Banner editorial, so da visao nacional (ver CLAUDE.md, Dia 6 Parte 3 /
// redesign). O fundo e definido via CSS em `.hero-banner` (index.css), em
// camadas: veu escuro (sempre) > foto (frontend/public/images/hero-bg.png,
// copiada de design-reference/hero-bg.png) > gradiente (fallback caso a
// foto nao carregue).
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
