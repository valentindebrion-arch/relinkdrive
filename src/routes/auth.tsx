import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, homeForRoles } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
  role: z.enum(["client", "driver"]).catch("client"),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Connexion — ${BRAND.name}` },
      {
        name: "description",
        content: "Connectez-vous ou créez votre compte chauffeur ou passager.",
      },
      { property: "og:title", content: `Connexion — ${BRAND.name}` },
      { property: "og:description", content: "Accédez à votre espace chauffeur ou passager." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { session, roles, loading } = useAuth();
  const [mode, setMode] = useState(search.mode);
  const [role, setRole] = useState(search.role);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      const dest = search.next && search.next.startsWith("/") ? search.next : homeForRoles(roles);
      navigate({ to: dest, replace: true });
    }
  }, [loading, session, roles, navigate, search.next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const loginEmail = email.includes("@")
      ? email.trim()
      : `${email.trim().toLowerCase()}@relink.app`;
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
            data: { full_name: fullName, phone, role },
          },
        });
        if (error) throw error;
        toast.success("Compte créé. Vous pouvez maintenant vous connecter.");
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (signInError) {
          toast.info("Vérifiez votre e-mail pour confirmer votre compte.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 text-sm font-bold text-foreground shadow-sm backdrop-blur transition hover:border-primary/30 hover:bg-card hover:text-primary active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à l'accueil
        </Link>
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="surface p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-md py-2 font-medium ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md py-2 font-medium ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Créer un compte
            </button>
          </div>

          {mode === "signup" ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(["client", "driver"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${
                    role === r ? "border-primary bg-accent text-accent-foreground" : "border-border"
                  }`}
                >
                  {r === "client" ? "Je suis client" : "Je suis chauffeur"}
                </button>
              ))}
            </div>
          ) : null}

          <GoogleSignInButton intent={role} next={search.next} />

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" ? (
              <>
                <div>
                  <Label htmlFor="name">Prénom et nom</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={30}
                  />
                </div>
              </>
            ) : null}
            <div>
              <Label htmlFor="email">
                {mode === "signin" ? "E-mail ou identifiant" : "E-mail"}
              </Label>
              <Input
                id="email"
                type={mode === "signin" ? "text" : "email"}
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Veuillez patienter…"
                : mode === "signin"
                  ? "Se connecter"
                  : "Créer mon compte"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {BRAND.name} ne propose aucune recherche publique de chauffeurs.
        </p>
      </div>
    </div>
  );
}
