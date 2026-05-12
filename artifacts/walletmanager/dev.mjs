import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";

const port = parseInt(process.env.PORT);
if (!port) throw new Error("PORT env var is required");

const basePath = process.env.BASE_PATH ?? "/";

let viteMiddleware = null;

const httpServer = createServer((req, res) => {
  if (viteMiddleware) {
    viteMiddleware(req, res, () => {
      res.writeHead(404);
      res.end("Not found");
    });
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body>Starting...</body></html>");
  }
});

httpServer.listen(port, "::", () => {
  console.log(`\n  WalletManager dev server listening on :::${port}`);
  console.log(`  ➜  Local:   http://localhost:${port}${basePath}\n`);
});

createViteServer({
  configFile: new URL("./vite.config.ts", import.meta.url).pathname,
  server: {
    middlewareMode: true,
    hmr: { server: httpServer },
  },
  appType: "spa",
}).then((vite) => {
  viteMiddleware = vite.middlewares;
  console.log("  Vite middleware ready");
}).catch((err) => {
  console.error("Vite init error:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  httpServer.close();
  process.exit(0);
});
