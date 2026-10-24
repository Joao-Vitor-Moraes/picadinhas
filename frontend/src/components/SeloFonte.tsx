import { useEffect, useState } from "react";
import { TEXTO_SELO_FONTE, TEXTO_SELO_2026_PARCIAL } from "../utils/format";

// Selo discreto de proveniencia (extensao pro PNI, ver CLAUDE.md): aparece
// em todo lugar que mostra cobertura de 2024 em diante. Zero jargao tecnico
// no texto visivel -- "PNI"/"SINASC"/"dedup" ficam so em comentario de
// codigo, nunca na tela.
export function SeloFonte({
  parcial,
  avisoVacina,
  textoBase = TEXTO_SELO_FONTE,
}: {
  parcial?: boolean;
  avisoVacina?: string;
  // Dia 8 Parte 1: o selo de risco reaproveita este componente (mesma
  // mecanica de abrir/fecha por clique, ja corrigida uma vez pro bug de
  // hover-vs-click) em vez de duplicar um novo so pra trocar o primeiro
  // paragrafo -- so o texto-base muda, o resto do comportamento e identico.
  textoBase?: string;
}) {
  const [aberto, setAberto] = useState(false);

  // fecha ao clicar fora -- so clique (nao hover) pra nao brigar com o
  // mouseleave quando o cursor passa por cima do botao antes de clicar
  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, [aberto]);

  return (
    <span className="selo-fonte-wrap">
      <button
        type="button"
        className="selo-fonte"
        onClick={(e) => {
          e.stopPropagation();
          setAberto((a) => !a);
        }}
      >
        estimado
      </button>
      {aberto && (
        <span className="selo-fonte-tip" role="tooltip">
          {textoBase}
          {parcial && (
            <>
              <br />
              <br />
              {TEXTO_SELO_2026_PARCIAL}
            </>
          )}
          {avisoVacina && (
            <>
              <br />
              <br />
              {avisoVacina}
            </>
          )}
        </span>
      )}
    </span>
  );
}
