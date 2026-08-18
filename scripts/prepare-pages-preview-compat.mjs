import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The original Pages preparer predates the production shell's shared base-path
// helpers and still performs literal replacements to add them. Normalize only
// this ephemeral Actions workspace to the shape that preparer expects; it then
// re-applies the same base-path behavior. Production source is never changed.
const shellPath = join(process.cwd(), "components/exchange/exchange-shell.tsx");
let source = await readFile(shellPath, "utf8");

source = source.replace(
  'import { withBasePath, withoutBasePath } from "@/lib/exchange/base-path";\n',
  "",
);
source = source.replace(
  'const parts = withoutBasePath(location.pathname).split("/").filter(Boolean);',
  'const parts = location.pathname.split("/").filter(Boolean);',
);
source = source.replace(
  'const url = `${location.origin}${withBasePath(`/exchange/${lens}/${record.id}`)}`;',
  'const url = `${location.origin}/exchange/${lens}/${record.id}`;',
);

await writeFile(shellPath, source, "utf8");
