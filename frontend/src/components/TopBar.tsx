import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";

export function TopBar() {
  const { uf, municipioIbge6 } = useRota();
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const ufCache = useAppStore((s) => s.ufCache);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();

  const nomeEstado = uf && resumoEstados ? resumoEstados[uf]?.nome : null;
  const nomeMunicipio =
    uf && municipioIbge6 ? ufCache[uf]?.dados.meta_municipios[municipioIbge6]?.nome : null;

  function irPara(path: string) {
    navigate({ pathname: path, search });
  }

  return (
    <div className="topbar">
      <span className="brand-name display">Picadinhas</span>
      <div className="breadcrumb">
        <button className={!uf ? "active" : ""} onClick={() => irPara("/")}>
          Brasil
        </button>
        {uf && nomeEstado && (
          <>
            <span className="sep">/</span>
            {municipioIbge6 ? (
              <button onClick={() => irPara(`/${uf}`)}>{nomeEstado}</button>
            ) : (
              <span className="current">{nomeEstado}</span>
            )}
          </>
        )}
        {municipioIbge6 && nomeMunicipio && (
          <>
            <span className="sep">/</span>
            <span className="current">{nomeMunicipio}</span>
          </>
        )}
      </div>
      <div className="topbar-meta">
        Dados do VacinaBR (iqc.org.br) · 2014–2023
        <br />
        5.570 municípios, 5 vacinas do calendário infantil
      </div>
    </div>
  );
}
