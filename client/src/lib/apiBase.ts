/**
 * Prefix API paths when the UI is hosted separately from the Express server
 * (e.g. Vercel static app + Railway API). Set `VITE_API_BASE_URL` on the Vercel project.
 */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
