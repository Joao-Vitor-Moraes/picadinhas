import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useRota } from "../hooks/useRota";
import { SeloFonte } from "./SeloFonte";
import { ehDadoEstimado } from "../utils/format";

export function TopBar() {
  const { uf, municipioIbge6 } = useRota();
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const ufCache = useAppStore((s) => s.ufCache);
  const serieNacional = useAppStore((s) => s.serieNacional);
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
      <div className="brand">
        <img className="brand-icon" src="/images/logo-icon.png" alt="" />
        <span className="brand-name display">Imuniza Brasil</span>
      </div>
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
        {(() => {
          const anos = serieNacional?.years ?? [2014, 2023];
          const ultimoAno = anos[anos.length - 1];
          const temEstimado = ehDadoEstimado(serieNacional?.brasil[String(ultimoAno)]?.fonte);
          return (
            <>
              Dados do VacinaBR (iqc.org.br) · {anos[0]}–{ultimoAno}
              {temEstimado && <SeloFonte />}
            </>
          );
        })()}
        <br />
        5.570 municípios, 5 vacinas do calendário infantil
      </div>
    </div>
  );
}
