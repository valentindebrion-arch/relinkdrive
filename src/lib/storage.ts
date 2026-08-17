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

/**
 * Résout plusieurs chemins d'objets en URL signées (une requête, cache partagé).
 * La clé de cache contient le bucket et la liste exacte des chemins : dès qu'un
 * chauffeur remplace sa photo, le chemin change et l'ancienne entrée n'est plus
 * utilisée. Les URL sont valides 1 h et renouvelées au bout de 45 min ; le cache
 * est conservé 24 h pour que la photo reste affichée lors des retours de route.
 */
export function useSignedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: ["signed-urls", bucket, list.join("|")],
    enabled: list.length > 0,
    staleTime: 1000 * 60 * 45,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Une seule requête à la fois pour une même clé, même si plusieurs vues la demandent.
    retry: 1,
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
