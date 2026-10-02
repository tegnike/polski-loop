import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localNativeTtsPlugin } from "./dev/local-tts";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "GOOGLE_TTS_API_KEY");
  const localNativeTts = command === "serve" && mode !== "test" && process.platform === "darwin" && !env.GOOGLE_TTS_API_KEY?.trim();
  return {
    plugins: [react(), ...(localNativeTts ? [localNativeTtsPlugin()] : [])],
    define: { __LOCAL_NATIVE_TTS__: JSON.stringify(localNativeTts) },
    optimizeDeps: {
      exclude: ["espeak-ng"],
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8787",
          changeOrigin: true,
        },
      },
    },
  };
});
