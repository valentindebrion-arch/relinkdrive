import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { setOAuthIntent, type OAuthIntentRole } from "@/lib/oauth-intent";
import { cn } from "@/lib/utils";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 3-2.26 5.54-4.78 7.25l7.73 6c4.51-4.18 7.09-10.36 7.09-17.72z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Bouton « Continuer avec Google » conforme aux règles de marque Google. */
export function GoogleSignInButton({
  intent,
  next,
  className,
  label = "Continuer avec Google",
}: {
  intent: OAuthIntentRole;
  next?: string | undefined;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      // Le choix de compte n'est jamais transmis dans l'URL : il est relu côté
      // serveur après authentification, et n'accorde jamais de rôle privilégié.
      setOAuthIntent(intent, next);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.redirected) return;
      if (result.error) throw result.error;
      window.location.replace("/auth/callback");
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion Google impossible.";
      toast.error(
        /cancel|closed|popup|abort/i.test(message)
          ? "Connexion Google annulée."
          : "Connexion Google impossible. Réessayez ou utilisez votre e-mail.",
      );
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      aria-busy={busy}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition",
        "hover:bg-muted/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <GoogleMark className="size-5 shrink-0" />
      <span>{busy ? "Redirection vers Google…" : label}</span>
    </button>
  );
}
