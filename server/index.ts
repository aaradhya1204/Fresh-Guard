import * as dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

// =====================
// PROCESS-LEVEL CRASH GUARDS
// =====================
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION — keeping server alive:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION — keeping server alive:", reason);
});

const app = express();
const httpServer = createServer(app);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// =====================
// RAW BODY SUPPORT
// =====================
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// =====================
// REQUEST TIMEOUT (30s)
// =====================
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ message: "Request timeout" });
    }
  });
  next();
});

// =====================
// HEALTH CHECK (NO DB REQUIRED)
// =====================
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// =====================
// LOGGER
// =====================
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// =====================
// REQUEST LOGGING
// =====================
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = (bodyJson: any) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// =====================
// BOOTSTRAP SERVER
// =====================
(async () => {
  try {
    log("Starting server initialization... (v3)");
    
    log("Registering routes...");
    await registerRoutes(httpServer, app);
    log("Routes registered successfully");

    // ---------- ERROR HANDLER ----------
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // ---------- STATIC / VITE ----------
    log(`NODE_ENV: ${process.env.NODE_ENV}`);
    if (process.env.NODE_ENV === "production") {
      log("Setting up static file serving...");
      serveStatic(app);
      log("Static file serving configured");
    } else {
      log("Setting up Vite dev middleware...");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      log("Vite dev middleware configured");
    }

    // ---------- START SERVER ----------
    const port = parseInt(process.env.PORT || "5000", 10);

    //  LISTEN ON ALL INTERFACES FOR CONTAINER DEPLOYMENT
    httpServer.listen(port, "0.0.0.0", () => {
      log(`serving on http://0.0.0.0:${port}`);
    });

    // ---------- GRACEFUL SHUTDOWN ----------
    const shutdown = (signal: string) => {
      log(`${signal} received — shutting down gracefully...`);
      httpServer.close(() => {
        log("HTTP server closed");
        process.exit(0);
      });
      // Force exit after 10s if connections don't close
      setTimeout(() => {
        log("Forcing exit after timeout");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
})();
