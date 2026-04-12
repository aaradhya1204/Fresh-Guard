import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertProduct } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/apiBase";

export function useProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const list = useQuery({
    queryKey: [api.products.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.products.list.path), { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch products");
      return api.products.list.responses[200].parse(await res.json());
    },
  });

  const create = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const res = await fetch(apiUrl(api.products.create.path), {
        method: api.products.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let message = `Failed to create product (${res.status})`;

        if (contentType.includes("application/json")) {
          const body = await res.json().catch(() => null);
          if (body?.message) message = body.message;
        }

        throw new Error(message);
      }

      return api.products.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Product created successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const url = apiUrl(buildUrl(api.products.delete.path, { id }));
      const res = await fetch(url, { method: api.products.delete.method, credentials: 'include' });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let message = `Failed to delete product (${res.status})`;

        if (contentType.includes("application/json")) {
          const body = await res.json().catch(() => null);
          if (body?.message) message = body.message;
        }

        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Product deleted" });
    },
  });

  return { products: list.data, isLoading: list.isLoading, create, remove };
}

export function useProductByQr(qrCodeId?: string) {
  return useQuery({
    queryKey: [api.products.getByQr.path, qrCodeId],
    queryFn: async () => {
      if (!qrCodeId) return null;
      const url = apiUrl(buildUrl(api.products.getByQr.path, { qrCodeId }));
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch product");
      return api.products.getByQr.responses[200].parse(await res.json());
    },
    enabled: !!qrCodeId,
  });
}
