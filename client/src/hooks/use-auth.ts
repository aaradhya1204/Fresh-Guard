import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type LoginRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/apiBase";
import { useLocation } from "wouter";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const userQuery = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.auth.me.path), { credentials: 'include' });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest & { role: 'admin' | 'user' }) => {
      const res = await fetch(apiUrl(api.auth.login.path), {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid credentials");
        }
        throw new Error("Login failed");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      // Clear cache to prevent data leaking from a previous session
      queryClient.clear();
      queryClient.setQueryData([api.auth.me.path], user);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.username}`,
      });
      if (user.role === 'admin') setLocation('/admin');
      else setLocation('/dashboard');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(apiUrl(api.auth.logout.path), { method: api.auth.logout.method, credentials: 'include' });
    },
    onSuccess: () => {
      // Clear all sensitive data from cache on logout
      queryClient.clear();
      queryClient.setQueryData([api.auth.me.path], null);
      setLocation('/');
      toast({
        title: "Logged out",
        description: "See you next time!",
      });
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
  };
}
