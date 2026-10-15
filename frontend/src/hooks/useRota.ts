import { useParams } from "react-router-dom";

export function useRota() {
  const { uf: ufParam, municipio: municipioParam } = useParams<{
    uf?: string;
    municipio?: string;
  }>();
  const uf = ufParam ? ufParam.toUpperCase() : null;
  const municipioIbge6 = municipioParam ? municipioParam.slice(0, 6) : null;
  const view: "national" | "state" = uf ? "state" : "national";
  return { uf, municipioIbge6, view };
}
