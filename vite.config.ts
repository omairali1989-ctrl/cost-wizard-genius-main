import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command }) => ({
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    {
      name: "mysql-api-middleware",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith("/api/")) {
            try {
              const { handleApiRequest } = await server.ssrLoadModule("./src/server/api.ts");
              const protocol = req.headers["x-forwarded-proto"] || "http";
              const host = req.headers.host || "localhost:8080";
              const fullUrl = new URL(req.url, `${protocol}://${host}`);

              let body: Buffer | undefined = undefined;
              if (req.method !== "GET" && req.method !== "HEAD") {
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                if (chunks.length > 0) {
                  body = Buffer.concat(chunks);
                }
              }

              const fetchReq = new Request(fullUrl.toString(), {
                method: req.method,
                headers: req.headers as any,
                body: body ? new Uint8Array(body) : undefined,
                // @ts-ignore
                duplex: "half",
              });

              const response = await handleApiRequest(fetchReq);
              res.statusCode = response.status;
              response.headers.forEach((val: string, key: string) => {
                res.setHeader(key, val);
              });
              const resBody = await response.arrayBuffer();
              res.end(Buffer.from(resBody));
            } catch (err: any) {
              console.error("MySQL API dev middleware error:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: { message: "Internal server error" } }));
            }
          } else {
            next();
          }
        });
      },
    },
    ...(command === "build" ? [nitro()] : []),

  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
  },
}));
