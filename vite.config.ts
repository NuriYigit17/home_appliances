import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import {
  supabasePublicUrl,
  supabasePublishableKey,
  vapidPublicKey,
} from "./deployment/public-env.ts";

export default defineConfig({
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabasePublicUrl),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      supabasePublishableKey,
    ),
    "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": JSON.stringify(vapidPublicKey),
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
