import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Buckets are private: resolve a stored object path to a temporary signed URL. */
export function useSignedUrl(bucket: string, path?: string | null) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

/** Résout plusieurs chemins d'objets en URL signées (une requête, cache partagé). */
export function useSignedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: ["signed-urls", bucket, list.join("|")],
    enabled: list.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(list, 60 * 60);
      const map: Record<string, string> = {};
      if (error || !data) return map;
      data.forEach((item) => {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      });
      return map;
    },
  });
}
