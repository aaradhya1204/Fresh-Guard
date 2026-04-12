import type { Express } from "express";
import type { Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { z } from "zod";

import { storage } from "./storage";
import { api } from "@shared/routes";

const SessionStore = MemoryStore(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowCrossSiteCookies = allowedOrigins.length > 0;

  // =====================
  // CORS (UI on Vercel, API on Railway, etc.)
  // =====================
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      );
      const reqHeaders = req.headers["access-control-request-headers"];
      res.setHeader(
        "Access-Control-Allow-Headers",
        typeof reqHeaders === "string" ? reqHeaders : "Content-Type",
      );
    }

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  });

  // =====================
  // SESSION SETUP
  // =====================
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "smart-label-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: allowCrossSiteCookies ? "none" : "lax",
        secure: allowCrossSiteCookies || process.env.NODE_ENV === "production",
      },
      store: new SessionStore({
        checkPeriod: 24 * 60 * 60 * 1000,
      }),
    })
  );

  // =====================
  // MIDDLEWARE
  // =====================
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session.userId) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.session.role === "admin") return next();
    res.status(403).json({ message: "Admin access required" });
  };

  // =====================
  // AUTH ROUTES
  // =====================
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password, customId, role } =
        api.auth.login.input.parse(req.body);

      // ---- ADMIN LOGIN ----
      if (role === "admin") {
        if (username !== "admin@gmail.com" || password !== "admin") {
          return res.status(401).json({ message: "Invalid admin credentials" });
        }

        let admin = await storage.getUserByUsername(username);
        if (!admin) {
          admin = await storage.createUser({
            username,
            password,
            role: "admin",
            customId: null,
          });
        }

        req.session.userId = admin.id;
        req.session.role = "admin";
        return res.json(admin);
      }

      // ---- USER LOGIN (CUSTOM / QR) ----
      if (!customId) {
        return res.status(400).json({ message: "customId required" });
      }

      let user = await storage.getUserByCustomId(customId);
      if (!user) {
        user = await storage.createUser({
          username: `user_${customId}`,
          password: "user",
          role: "user",
          customId,
        });
      }

      req.session.userId = user.id;
      req.session.role = "user";
      return res.json(user);

    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).send();
    res.json(user);
  });

  // =====================
  // PRODUCT ROUTES
  // =====================
  app.get(api.products.list.path, async (_, res) => {
    res.json(await storage.getProducts());
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  });

  app.get(api.products.getByQr.path, async (req, res) => {
    const qrCodeId = String(req.params.qrCodeId);
    const product = await storage.getProductByQr(qrCodeId);
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  });

  app.post(api.products.create.path, isAdmin, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);

      const product = await storage.createProduct({
        ...input,
      });

      res.status(201).json(product);
    } catch (err) {
      console.error("Error creating product:", err); // Log the full error
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  });

  app.put(api.products.update.path, isAdmin, async (req, res) => {
    const input = api.products.update.input.parse(req.body);
    const product = await storage.updateProduct(
      Number(req.params.id),
      input
    );
    res.json(product);
  });

  app.delete(api.products.delete.path, isAdmin, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.status(204).send();
  });

  // =====================
  // PURCHASE ROUTES
  // =====================
  app.get(api.purchases.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getPurchases(req.session.userId as number));
  });

  app.post(api.purchases.create.path, isAuthenticated, async (req, res) => {
    const { productIds } = api.purchases.create.input.parse(req.body);

    for (const productId of productIds) {
      await storage.createPurchase({
        userId: req.session.userId as number,
        productId,
      });
    }

    res.status(201).json({ message: "Purchases recorded" });
  });

  // =====================
  // SEED DATABASE
  // =====================
  await seedDatabase();

  return httpServer;
}

// =====================
// FINAL SEED FUNCTION
// =====================
async function seedDatabase() {
  const existing = await storage.getProducts();
  if (existing.length > 0) return;

  console.log("Seeding database...");

  const toYmd = (d: Date) => d.toISOString().slice(0, 10);

  await storage.createProduct({
    name: "Fresh Milk",
    price: 250,
    manufacturingDate: "2023-10-25",
    expiryDate: toYmd(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    ingredients: ["Whole Milk", "Vitamin D3"],
    nutritionalInfo: {
      calories: 150,
      fat: "8g",
      protein: "8g",
    },
    qrCodeId: "prod_milk_001",
  });

  await storage.createProduct({
    name: "Organic Bread",
    price: 400,
    manufacturingDate: "2023-10-26",
    expiryDate: toYmd(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    ingredients: ["Wheat Flour", "Water", "Salt", "Yeast"],
    nutritionalInfo: {
      calories: 100,
      carbs: "20g",
      fiber: "5g",
    },
    qrCodeId: "prod_bread_002",
  });

  await storage.createProduct({
    name: "Expired Yogurt",
    price: 150,
    manufacturingDate: "2023-09-01",
    expiryDate: toYmd(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    ingredients: ["Milk", "Live Cultures", "Strawberry"],
    nutritionalInfo: {
      calories: 90,
      sugar: "12g",
    },
    qrCodeId: "prod_yogurt_003",
  });

  console.log(" Database seeded successfully");
}
