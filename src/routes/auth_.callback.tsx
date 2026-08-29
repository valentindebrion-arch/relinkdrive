import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { finalizeOAuthAccount } from "@/lib/oauth-account.functions";
import { clearOAuthIntent, readOAuthIntent } from "@/lib/oauth-intent";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Connexion en cours — ${BRAND.name}` },
      { name: "description", content: "Finalisation de votre connexion sécurisée." },
      { property: "og:title", content: `Connexion en cours — ${BRAND.name}` },
      { property: "og:description", content: "Finalisation de votre connexion sécurisée." },
    ],
  }),
  component: CallbackPage,
});

const MESSAGES: Record<string, string> = {
  access_denied: "Connexion Google annulée. Vous pouvez réessayer ou utiliser votre e-mail.",
  no_email:
    "Aucune adresse e-mail n'a été transmise par Google. Utilisez une autre méthode de connexion.",
  invalid: "Le lien de connexion est invalide ou expiré. Merci de recommencer.",
  email_exists:
    "Un compte existe déjà avec cette adresse e-mail. Connectez-vous avec votre méthode habituelle pour associer Google à votre compte.",
  suspended: "Ce compte est suspendu. Contactez le support ReLink.",
  network: "Connexion impossible pour le moment. Vérifiez votre réseau puis réessayez.",
};

function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const oauthError = params.get("error") ?? hash.get("error");
      const desc = params.get("error_description") ?? hash.get("error_description") ?? "";

      // On nettoie immédiatement les paramètres sensibles de l'URL.
      window.history.replaceState({}, "", "/auth/callback");

      if (oauthError) {
        if (/denied|cancel/i.test(oauthError)) return setError(MESSAGES["access_denied"]!);
        if (/email/i.test(desc) && /exist|registered/i.test(desc))
          return setError(MESSAGES["email_exists"]!);
        return setError(MESSAGES["invalid"]!);
      }

      let session = (await supabase.auth.getSession()).data.session;
      // La session peut arriver juste après la redirection : petite attente active.
      for (let i = 0; !session && i < 10; i++) {
        await new Promise((r) => setTimeout(r, 250));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session) return setError(MESSAGES["invalid"]!);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) return setError(MESSAGES["invalid"]!);
      if (!userData.user.email) return setError(MESSAGES["no_email"]!);

      const intent = readOAuthIntent();
      try {
        const result = await finalizeOAuthAccount({
          data: intent?.role ? { intent: intent.role } : {},
        });
        clearOAuthIntent();

        if (result.status === "suspended") {
          await supabase.auth.signOut();
          return setError(MESSAGES["suspended"]!);
        }

        const next = intent?.next;
        if (next && next.startsWith("/")) return navigate({ to: next, replace: true });

        if (result.role === "admin") return navigate({ to: "/admin", replace: true });
        if (result.role === "driver") {
          const incomplete = result.driverStatus !== "verified";
          return navigate({ to: incomplete ? "/pro/profil" : "/pro", replace: true });
        }
        return navigate({
          to: result.needsProfile ? "/espace/parametres" : "/espace",
          replace: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setError(/fetch|network/i.test(message) ? MESSAGES["network"]! : MESSAGES["invalid"]!);
      }
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        {error ? (
          <div className="surface space-y-4 p-6">
            <p className="text-sm text-foreground">{error}</p>
            <Button
              className="w-full"
              onClick={() => navigate({ to: "/auth", search: { mode: "signin", role: "client" } })}
            >
              Revenir à la connexion
            </Button>
          </div>
        ) : (
          <div className="surface space-y-3 p-6">
            <div className="mx-auto size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Finalisation de votre connexion…</p>
          </div>
        )}
      </div>
    </div>
  );
}
