
import { db } from "./db";
import {
  users, products, purchases,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Purchase, type InsertPurchase
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByCustomId(customId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Product
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByQr(qrCodeId: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Purchase
  getPurchases(userId: number): Promise<{ purchase: Purchase; product: Product }[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
}

export class DatabaseStorage implements IStorage {
  // User Operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByCustomId(customId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.customId, customId));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Product Operations
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.manufacturingDate));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByQr(qrCodeId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.qrCodeId, qrCodeId));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Purchase Operations
  async getPurchases(userId: number): Promise<{ purchase: Purchase; product: Product }[]> {
    const results = await db
      .select({
        purchase: purchases,
        product: products,
      })
      .from(purchases)
      .innerJoin(products, eq(purchases.productId, products.id))
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.purchasedAt));

    // IMPORTANT: Keep this shape aligned with `shared/routes.ts`.
    return results.map((r) => ({
      purchase: r.purchase,
      product: r.product,
    }));
  }

  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [newPurchase] = await db.insert(purchases).values(purchase).returning();
    return newPurchase;
  }
}

export const storage = new DatabaseStorage();
