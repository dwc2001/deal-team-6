import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

// Lets `npm run dev` scan cards without Supabase: put ANTHROPIC_API_KEY in
// .env.local and the app calls this instead of the Edge Function.
function devScanApi(env: Record<string, string>): Plugin {
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  const readJson = (req: IncomingMessage) =>
    new Promise<unknown>((resolve, reject) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });

  return {
    name: "dt6-dev-scan-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/scan-card", async (req, res) => {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
        try {
          const body = (await readJson(req)) as never;
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const { extractCards } = await server.ssrLoadModule("/supabase/functions/scan-card/extract.ts");
          const client = new Anthropic({
            ...(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
            ...(env.ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } } : {}),
          });
          send(res, 200, await extractCards(client, body, { model: env.CARD_SCAN_MODEL }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const noKey = /api key|apiKey|authentication|credentials/i.test(message);
          send(res, noKey ? 501 : 500, {
            error: noKey ? "Add ANTHROPIC_API_KEY to .env.local to test the scanner locally." : message,
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "./",
    plugins: [react(), devScanApi(env)],
  };
});
