import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Link2, Unlink } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PROVIDER_LABELS: Record<string, string> = {
  email: "E-mail et mot de passe",
  google: "Google",
};

export function SecuritySection() {
  const { user, profile } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUserIdentities().then(({ data }) => {
      setIdentities(data?.identities ?? []);
    });
  }, [user?.id]);

  const hasPassword = identities.some((i) => i.provider === "email");
  const hasGoogle = identities.some((i) => i.provider === "google");
  const email = profile?.email ?? user?.email ?? "";

  async function changePassword() {
    if (next.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (next !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (authError) throw new Error("Mot de passe actuel incorrect.");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setCurrent("");
      setNext("");
      setConfirm("");
      setChanging(false);
      toast.success("Mot de passe modifié.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    if (!email) return;
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Un lien de réinitialisation a été envoyé à votre adresse e-mail.");
    } finally {
      setBusy(false);
    }
  }

  async function linkGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/espace/parametres` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Association Google impossible pour le moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function unlinkGoogle() {
    const identity = identities.find((i) => i.provider === "google");
    if (!identity || identities.length < 2) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      const { data } = await supabase.auth.getUserIdentities();
      setIdentities(data?.identities ?? []);
      toast.success("Compte Google dissocié.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dissociation impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">Sécurité et connexion</h2>

      <div className="mt-3 space-y-2">
        <p className="text-sm font-medium">Méthodes de connexion</p>
        <ul className="space-y-2">
          {identities.length === 0 ? (
            <li className="text-xs text-muted-foreground">Chargement…</li>
          ) : (
            identities.map((i) => (
              <li
                key={i.identity_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  {PROVIDER_LABELS[i.provider] ?? i.provider}
                </span>
                {i.provider === "google" && identities.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-muted-foreground"
                    onClick={() => void unlinkGoogle()}
                    disabled={busy}
                  >
                    <Unlink className="size-3.5" /> Retirer
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {!hasGoogle ? (
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => void linkGoogle()}
            disabled={busy}
          >
            <Link2 className="size-4" /> Associer mon compte Google
          </Button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm font-medium">Mot de passe</p>
        {hasPassword ? (
          changing ? (
            <div className="mt-3 grid gap-3">
              <div>
                <Label htmlFor="cp-cur">Mot de passe actuel</Label>
                <Input
                  id="cp-cur"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cp-new">Nouveau mot de passe</Label>
                <Input
                  id="cp-new"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cp-conf">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="cp-conf"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button className="min-h-11" onClick={() => void changePassword()} disabled={busy}>
                  Enregistrer
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setChanging(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="mt-3 min-h-11 w-full"
              onClick={() => setChanging(true)}
            >
              <KeyRound className="size-4" /> Modifier mon mot de passe
            </Button>
          )
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Vous vous connectez uniquement avec Google : aucun mot de passe n'est associé à votre
            compte. Vous pouvez en créer un en recevant un lien sécurisé par e-mail.
          </p>
        )}

        <Button
          variant="ghost"
          className="mt-2 min-h-11 w-full"
          onClick={() => void sendReset()}
          disabled={busy || !email}
        >
          {hasPassword
            ? "Réinitialiser mon mot de passe par e-mail"
            : "Créer un mot de passe par e-mail"}
        </Button>
      </div>
    </section>
  );
}
