import { useEffect } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import { useRota } from "./hooks/useRota";
import { TopBar } from "./components/TopBar";
import { StageIntro } from "./components/StageIntro";
import { MapView } from "./components/MapView";
import { StatRail } from "./components/StatRail";
import { RankingTable } from "./components/RankingTable";

function App() {
  const loadBoot = useAppStore((s) => s.loadBoot);
  const bootLoading = useAppStore((s) => s.bootLoading);
  const bootError = useAppStore((s) => s.bootError);
  const brazilPaths = useAppStore((s) => s.brazilPaths);

  useEffect(() => {
    loadBoot();
  }, [loadBoot]);

  if (bootError) {
    return <div className="error-screen">Erro ao carregar os dados: {bootError}</div>;
  }
  if (bootLoading || !brazilPaths) {
    return <div className="loading-screen">Carregando…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Pagina />} />
      <Route path="/:uf" element={<Pagina />} />
      <Route path="/:uf/:municipio" element={<Pagina />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Pagina() {
  const { uf } = useRota();
  const resumoEstados = useAppStore((s) => s.resumoEstados);
  const [searchParams] = useSearchParams();

  // UF desconhecida na URL (ex: link quebrado ou digitado errado) -> volta pro nacional
  if (uf && resumoEstados && !resumoEstados[uf]) {
    return <Navigate to={{ pathname: "/", search: searchParams.toString() }} replace />;
  }

  return (
    <div className="app">
      <TopBar />

      <div className="stage">
        <StageIntro />
        <div className="map-col">
          <MapView />
          <StatRail />
        </div>
      </div>

      <div className="note-strip">
        <strong>Picadinhas</strong> — cobertura vacinal nos municípios brasileiros (BCG,
        Poliomielite inativada, Pentavalente, Tríplice Viral, Hepatite B), 2014–2023. Dados do{" "}
        <a href="https://iqc.org.br/observatorio/vacinabr" target="_blank" rel="noreferrer">
          VacinaBR (iqc.org.br)
        </a>
        .
      </div>

      <RankingTable />

      <footer className="foot">
        Dados do VacinaBR, 2014–2023. Uso de dados de saúde pública; não é diagnóstico nem
        recomendação médica.
      </footer>
    </div>
  );
}

export default App;
