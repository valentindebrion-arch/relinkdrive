import { useSignedUrl } from "@/lib/storage";

/**
 * Photo de profil ReLink.
 *
 * `avatar_url` contient soit une URL publique (compte Google), soit un chemin
 * dans le bucket privé `avatars` (photo envoyée depuis « Ma vitrine »). Ce hook
 * résout les deux cas de la même manière pour tous les affichages.
 */
export function useDisplayAvatar(value?: string | null) {
  const isUrl = !!value && /^https?:\/\//.test(value);
  const signed = useSignedUrl("avatars", isUrl ? null : (value ?? null));
  return isUrl ? (value as string) : (signed.data ?? null);
}

export function AvatarPhoto({
  url,
  name,
  className = "size-12 rounded-full object-cover",
  fallbackClassName,
}: {
  url?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const resolved = useDisplayAvatar(url);
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  if (resolved) return <img src={resolved} alt={name ?? ""} className={className} />;
  return (
    <span
      className={
        fallbackClassName ??
        `${className} flex items-center justify-center bg-accent font-semibold text-accent-foreground`
      }
    >
      {initial}
    </span>
  );
}
