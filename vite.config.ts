// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `node-zugferd` (et ses dépendances tslib/pdf-lib) plante à l'initialisation
// dans le runtime serveur. Il est chargé dynamiquement par le module Factur-X,
// mais il doit aussi être isolé dans son propre fichier : autrement il se
// retrouve empaqueté avec zod, chargé au démarrage, et fait tomber toute l'app.
const isolateFacturX = (id: string) => {
  if (/node_modules\/(node-zugferd|pdf-lib|tslib)\//.test(id)) return "facturx-vendor";
  return undefined;
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // tslib expose un CJS dont l'interop casse au bundling serveur
        // (`Cannot destructure property '__extends'`) : on force la version ESM.
        tslib: "tslib/tslib.es6.js",
      },
    },
    build: {
      rollupOptions: {
        output: { manualChunks: isolateFacturX },
      },
    },
  },
});
