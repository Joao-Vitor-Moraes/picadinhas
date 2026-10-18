import { useEffect, useState } from "react";
import { TEXTO_SELO_FONTE, TEXTO_SELO_2026_PARCIAL } from "../utils/format";

// Selo discreto de proveniencia (extensao pro PNI, ver CLAUDE.md): aparece
// em todo lugar que mostra cobertura de 2024 em diante. Zero jargao tecnico
// no texto visivel -- "PNI"/"SINASC"/"dedup" ficam so em comentario de
// codigo, nunca na tela.
export function SeloFonte({ parcial, avisoVacina }: { parcial?: boolean; avisoVacina?: string }) {
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
          {TEXTO_SELO_FONTE}
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
