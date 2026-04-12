import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/apiBase";

export function usePurchases() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const list = useQuery({
    queryKey: [api.purchases.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.purchases.list.path), { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return api.purchases.list.responses[200].parse(await res.json());
    },
  });

  const create = useMutation({
    mutationFn: async (productIds: number[]) => {
      const res = await fetch(apiUrl(api.purchases.create.path), {
        method: api.purchases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to complete purchase");
      return api.purchases.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchases.list.path] });
      toast({ title: "Purchase successful", description: "Items added to your history" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Purchase failed", description: error.message });
    },
  });

  return { purchases: list.data, isLoading: list.isLoading, create };
}
