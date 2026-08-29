import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
  error_code: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  ssr: false,
  head: () => ({
    meta: [
      { title: `Nouveau mot de passe — ${BRAND.name}` },
      {
        name: "description",
        content: "Définissez un nouveau mot de passe pour votre compte Relink en toute sécurité.",
      },
      { property: "og:title", content: `Nouveau mot de passe — ${BRAND.name}` },
      {
        property: "og:description",
        content: "Réinitialisation sécurisée de votre mot de passe Relink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

type State = "checking" | "ready" | "invalid" | "done";

function readHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const hash = readHashParams();
      if (search.error || search.error_code || hash.get("error")) {
        setState("invalid");
        return;
      }

      try {
        if (search.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (error) throw error;
        } else if (search.token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: search.token_hash,
            type: "recovery",
          });
          if (error) throw error;
        } else {
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }

        const { data } = await supabase.auth.getSession();
        setState(data.session ? "ready" : "invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [search]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setState("done");
      toast.success("Votre mot de passe a bien été modifié.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="surface p-6">
          <h1 className="text-xl font-bold">Nouveau mot de passe</h1>

          {state === "checking" ? (
            <p className="mt-3 text-sm text-muted-foreground">Vérification de votre lien…</p>
          ) : null}

          {state === "invalid" ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Ce lien de réinitialisation n'est plus valide ou a déjà été utilisé. Demandez un
                nouveau lien depuis la page de connexion.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/auth">Retour à la connexion</Link>
              </Button>
            </>
          ) : null}

          {state === "ready" ? (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="np">Nouveau mot de passe</Label>
                <Input
                  id="np"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  minLength={8}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="np2">Confirmer le mot de passe</Label>
                <Input
                  id="np2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  minLength={8}
                  required
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
              </Button>
            </form>
          ) : null}

          {state === "done" ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Votre mot de passe a été mis à jour. Vous pouvez maintenant utiliser Relink.
              </p>
              <Button
                className="mt-4 w-full"
                onClick={() => navigate({ to: "/espace", replace: true })}
              >
                Aller à mon espace
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
