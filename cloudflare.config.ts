import { bindings, defineConfig, defineWorker } from "cf/config";
import {
  supabasePublicUrl,
  supabasePublishableKey,
} from "./deployment/public-env.ts";

export default defineConfig({
  accountId: "b79a574e294062de6d9e3da4b4dfa50a",
  worker: defineWorker({
    name: "home-appliances",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-27",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text(supabasePublicUrl),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text(supabasePublishableKey),
    },
  }),
});
