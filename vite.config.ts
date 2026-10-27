import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import {
  supabasePublicUrl,
  supabasePublishableKey,
} from "./deployment/public-env.ts";

export default defineConfig({
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabasePublicUrl),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      supabasePublishableKey,
    ),
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
