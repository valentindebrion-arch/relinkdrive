import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, homeForRoles } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
  email: z.string().optional(),
  error: z.string().optional(),
  error_code: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: searchSchema,
  ssr: false,
  head: () => ({
    meta: [
      { title: `Confirmation de l'e-mail — ${BRAND.name}` },
      {
        name: "description",
        content: "Confirmez votre adresse e-mail pour activer votre compte.",
      },
      { property: "og:title", content: `Confirmation de l'e-mail — ${BRAND.name}` },
      { property: "og:description", content: "Activation de votre compte." },
    ],
  }),
  component: ConfirmPage,
});

type State = "pending" | "success" | "expired" | "invalid" | "network" | "already";

const MESSAGES: Record<Exclude<State, "pending" | "success">, string> = {
  expired: "Ce lien de confirmation n'est plus valide. Demandez un nouvel e-mail pour confirmer votre compte.",
  invalid: "Ce lien de confirmation n'est plus valide. Demandez un nouvel e-mail pour confirmer votre compte.",
  already: "Cette adresse e-mail est déjà confirmée. Vous pouvez vous connecter.",
  network: "Impossible de vérifier votre lien pour le moment. Vérifiez votre connexion puis réessayez.",
};

/** Récupère les paramètres présents dans le fragment (#) pour l'ancien flux implicite. */
function readHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function ConfirmPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { session, roles, loading } = useAuth();
  const [state, setState] = useState<State>("pending");
  const [email, setEmail] = useState(search.email ?? "");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const hash = readHashParams();
      const errCode = search.error_code ?? hash.get("error_code") ?? "";
      const err = search.error ?? hash.get("error") ?? "";

      if (err || errCode) {
        setState(/expired|otp_expired/i.test(errCode + err) ? "expired" : "invalid");
        return;
      }

      try {
        // Flux PKCE : ?code=...
        if (search.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (error) throw error;
          setState("success");
          return;
        }

        // Flux OTP par lien : ?token_hash=...&type=signup
        if (search.token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: search.token_hash,
            type: (search.type as EmailOtpType) || "signup",
          });
          if (error) throw error;
          setState("success");
          return;
        }

        // Flux implicite : #access_token=...&refresh_token=...
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setState("success");
          return;
        }

        // Aucun paramètre : la session peut déjà exister (lien déjà utilisé).
        const { data } = await supabase.auth.getSession();
        setState(data.session ? "already" : "invalid");
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (/failed to fetch|network/i.test(message)) setState("network");
        else if (/expired/i.test(message)) setState("expired");
        else if (/already|confirmed/i.test(message)) setState("already");
        else setState("invalid");
      }
    })();
  }, [search.code, search.token_hash, search.type, search.error, search.error_code]);

  // Session valide : on emmène l'utilisateur vers son espace réel.
  useEffect(() => {
    if (state !== "success" || loading || !session) return;
    const t = setTimeout(() => navigate({ to: homeForRoles(roles), replace: true }), 1200);
    return () => clearTimeout(t);
  }, [state, loading, session, roles, navigate]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) throw error;
      toast.success("Un nouvel e-mail de confirmation vient d'être envoyé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="surface p-6 text-center">
          {state === "pending" ? (
            <>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Confirmation en cours…</p>
            </>
          ) : null}

          {state === "success" ? (
            <>
              <h1 className="text-lg font-semibold text-foreground">
                Votre adresse e-mail a bien été confirmée. Vous pouvez maintenant vous connecter.
              </h1>
              <div className="mt-6">
                <Button asChild className="w-full">
                  <Link to="/auth" search={{ mode: "signin", role: "client" }}>
                    Se connecter
                  </Link>
                </Button>
              </div>
            </>
          ) : null}

          {state === "already" ? (
            <>
              <h1 className="text-lg font-semibold text-foreground">{MESSAGES.already}</h1>
              <div className="mt-6">
                <Button asChild className="w-full">
                  <Link to="/auth" search={{ mode: "signin", role: "client" }}>
                    Se connecter
                  </Link>
                </Button>
              </div>
            </>
          ) : null}

          {state === "expired" || state === "invalid" || state === "network" ? (
            <>
              <h1 className="text-lg font-semibold text-foreground">{MESSAGES[state]}</h1>
              <form onSubmit={resend} className="mt-5 space-y-3 text-left">
                <div>
                  <Label htmlFor="confirm-email">Votre e-mail</Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    required
                    maxLength={255}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Envoi en cours…" : "Renvoyer l'e-mail de confirmation"}
                </Button>
              </form>
              <div className="mt-3">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth" search={{ mode: "signin", role: "client" }}>
                    Se connecter
                  </Link>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
