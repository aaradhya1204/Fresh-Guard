
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  customId: text("custom_id"), // For the "Aadhaar-like" numeric ID
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // In cents or smallest currency unit
  manufacturingDate: timestamp("manufacturing_date", { mode: "string" }).notNull(),
  expiryDate: timestamp("expiry_date", { mode: "string" }).notNull(),
  nutritionalInfo: jsonb("nutritional_info").notNull(),
  ingredients: text("ingredients").array(), // Array of strings
  qrCodeId: text("qr_code_id").notNull().unique(), // The ID encoded in the QR
  batchId: text("batch_id").default("Standard Batch"), // The batch identifier
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // References users.id
  productId: integer("product_id").notNull(), // References products.id
  purchasedAt: timestamp("purchased_at", { mode: "string" }).defaultNow(),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

// Drizzle-Zod uses `z.date()` for timestamps, but over the wire we often receive ISO strings.
// Coerce to Date so server-side parsing works with JSON payloads.
const baseInsertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertProductSchema = baseInsertProductSchema.extend({
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid manufacturingDate"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expiryDate"),
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true, purchasedAt: true });

// === EXPLICIT TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

// API Request/Response Types
export type LoginRequest = {
  username?: string; // For admin
  customId?: string; // For user
  password?: string; // For admin
};

export type ProductResponse = Product & {
  isExpired: boolean;
  expiresInDays: number;
};
