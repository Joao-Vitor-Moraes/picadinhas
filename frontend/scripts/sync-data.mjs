// Copia so os JSONs que o frontend consome de ../data/processed para
// public/data/ (nao os CSVs brutos de analise). data/processed/ e a fonte
// unica de verdade (gerada pelos notebooks); public/data/ e so uma copia de
// build, por isso fica no .gitignore.
import { cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const origem = path.join(frontendDir, "..", "data", "processed");
const destino = path.join(frontendDir, "public", "data");

if (!existsSync(origem)) {
  console.error(`Pasta de origem nao encontrada: ${origem}`);
  process.exit(1);
}

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

const arquivosDeTopo = [
  "brazil-states-paths.json",
  "resumo_estados.json",
  "serie_nacional.json",
  "risco_resumo.json",
];
for (const nome of arquivosDeTopo) {
  await cp(path.join(origem, nome), path.join(destino, nome));
}
await cp(path.join(origem, "municipios"), path.join(destino, "municipios"), {
  recursive: true,
  filter: (src) => !src.endsWith(".csv"),
});

console.log(`Dados copiados de ${origem} para ${destino}`);
