
import { z } from 'zod';
import { insertUserSchema, insertProductSchema, insertPurchaseSchema, products, purchases, users } from './schema';

// Re-export for frontend usage
export { insertProductSchema, insertUserSchema, insertPurchaseSchema };
export type { InsertUser, InsertPurchase, Product, User, Purchase, LoginRequest } from './schema';

// Create a writable version of InsertProduct for the client (dates as strings)
export type InsertProduct = Omit<z.infer<typeof insertProductSchema>, 'manufacturingDate' | 'expiryDate'> & {
  manufacturingDate: string;
  expiryDate: string;
};

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        username: z.string().optional(),
        password: z.string().optional(),
        customId: z.string().optional(),
        role: z.enum(['admin', 'user']),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    getByQr: {
      method: 'GET' as const,
      path: '/api/products/qr/:qrCodeId',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id',
      input: insertProductSchema.partial(),
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  purchases: {
    list: {
      method: 'GET' as const,
      path: '/api/purchases',
      responses: {
        200: z.array(z.object({
          purchase: z.custom<typeof purchases.$inferSelect>(),
          product: z.custom<typeof products.$inferSelect>(),
        })),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/purchases',
      input: z.object({
        productIds: z.array(z.number()),
      }),
      responses: {
        201: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/purchases/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
