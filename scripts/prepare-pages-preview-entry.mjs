import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The legacy Pages projection rewrites an inline Web Share URL that no longer exists in
// production because Share is now owned by the authenticated shared-workflow service.
// GitHub Pages has no runtime API routes, so inject that rewrite anchor only into the
// ephemeral preview workspace. The production source remains service-backed.
const exchangeShellPath = join(process.cwd(), "components/exchange/exchange-shell.tsx");
let exchangeShell = await readFile(exchangeShellPath, "utf8");
const legacyShareAnchor = 'const url = `${location.origin}/exchange/${lens}/${record.id}`;';
if (!exchangeShell.includes(legacyShareAnchor)) {
  const styleImport = 'import styles from "./exchange-shell.module.css";';
  if (!exchangeShell.includes(styleImport)) throw new Error("Pages preview could not locate the Exchange shell style import.");
  exchangeShell = exchangeShell.replace(styleImport, `// Pages-preview-only compatibility anchor: ${legacyShareAnchor}\n${styleImport}`);
  await writeFile(exchangeShellPath, exchangeShell, "utf8");
}

await import("./prepare-pages-preview.mjs");
