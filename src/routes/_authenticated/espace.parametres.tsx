import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, pushSupported, requestLocation } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/espace/parametres")({
  component: ClientSettings,
});

function ClientSettings() {
  const { user, profile, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [pushOn, setPushOn] = useState(false);
  const [locationOn, setLocationOn] = useState(false);
  const [busy, setBusy] = useState<null | "push" | "location">(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  useEffect(() => {
    setSupported(pushSupported());
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("profiles")
      .select("push_enabled, location_enabled")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPushOn(Boolean(data?.push_enabled));
        setLocationOn(Boolean(data?.location_enabled));
      });
  }, [user?.id]);

  async function save() {
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil mis à jour");
    await refresh();
  }

  async function togglePush(next: boolean) {
    if (!user?.id) return;
    setBusy("push");
    try {
      if (next) {
        await enablePush(user.id);
        setPushOn(true);
        toast.success("Notifications mobiles activées");
      } else {
        await disablePush(user.id);
        setPushOn(false);
        toast.success("Notifications mobiles désactivées");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation impossible");
    } finally {
      setBusy(null);
    }
  }

  async function toggleLocation(next: boolean) {
    if (!user?.id) return;
    setBusy("location");
    try {
      if (next) await requestLocation();
      const { error } = await supabase
        .from("profiles")
        .update({ location_enabled: next })
        .eq("id", user.id);
      if (error) throw error;
      setLocationOn(next);
      toast.success(next ? "Position activée" : "Position désactivée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Position indisponible");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Paramètres" description="Vos informations personnelles et vos autorisations." />
      <div className="surface grid max-w-xl gap-4 p-5">
        <div>
          <Label htmlFor="fn">Nom complet</Label>
          <Input id="fn" value={form.full_name} maxLength={80} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ph">Téléphone</Label>
          <Input id="ph" value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={profile?.email ?? ""} disabled />
        </div>
        <div>
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>

      <div className="surface mt-4 grid max-w-xl gap-4 p-5">
        <p className="text-sm font-semibold">Autorisations de l'appareil</p>

        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <Bell className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Notifications mobiles</p>
              <p className="text-xs text-muted-foreground">
                Recevez chaque étape de votre course, même application fermée ou écran verrouillé.
              </p>
              {!supported ? (
                <p className="mt-1 text-xs text-destructive">
                  Non disponible ici. Sur iPhone, ajoutez d'abord Relink à l'écran d'accueil.
                </p>
              ) : null}
            </div>
          </div>
          <Switch
            checked={pushOn}
            disabled={!supported || busy === "push"}
            onCheckedChange={(v) => void togglePush(v)}
            aria-label="Activer les notifications mobiles"
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Position</p>
              <p className="text-xs text-muted-foreground">
                Pré-remplit votre adresse de départ et affiche les chauffeurs autour de vous.
              </p>
            </div>
          </div>
          <Switch
            checked={locationOn}
            disabled={busy === "location"}
            onCheckedChange={(v) => void toggleLocation(v)}
            aria-label="Activer la position"
          />
        </div>
      </div>
    </>
  );
}
