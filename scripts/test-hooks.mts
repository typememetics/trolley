// Lets `node --test` load the app's TypeScript as Next does: `@/` paths and extensionless
// imports. Run with --conditions=react-server so `server-only` modules load outside Next.
import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const isFile = (url: URL) => statSync(fileURLToPath(url), { throwIfNoEntry: false })?.isFile() ?? false;

registerHooks({
  resolve(specifier, context, next) {
    const fromApp = context.parentURL?.startsWith(root.href) && !context.parentURL.includes("/node_modules/");
    const local = !fromApp ? null
      : specifier.startsWith("@/") ? new URL(specifier.slice(2), root)
      : specifier.startsWith(".") ? new URL(specifier, context.parentURL)
      : null;
    if (!local) return next(specifier, context);
    const found = isFile(local) ? local : [".ts", ".tsx", "/index.ts"].map(ext => new URL(local.href + ext)).find(isFile);
    return next(found?.href ?? local.href, context);
  },
});
