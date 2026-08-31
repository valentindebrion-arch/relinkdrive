import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, CreditCard, FileText, MapPin, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { requestLocation } from "@/lib/push";
import { PersonalInfoSection } from "@/components/client/PersonalInfoSection";
import { SecuritySection } from "@/components/client/SecuritySection";
import { SupportSection } from "@/components/client/SupportSection";
import { AccountSection } from "@/components/client/AccountSection";

export const Route = createFileRoute("/_authenticated/espace/parametres")({
  head: () => ({
    meta: [
      { title: "Mon profil — Relink" },
      {
        name: "description",
        content:
          "Gérez vos informations, votre sécurité, vos préférences et votre compte passager Relink.",
      },
      { property: "og:title", content: "Mon profil — Relink" },
      {
        property: "og:description",
        content: "Le centre de gestion de votre compte passager Relink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientProfile,
});

const LEGAL_LINKS = [
  { doc: "cgu", label: "Conditions générales d'utilisation" },
  { doc: "confidentialite", label: "Politique de confidentialité" },
  { doc: "mentions", label: "Mentions légales" },
  { doc: "donnees", label: "Données personnelles et consentements" },
] as const;

function initials(name: string | undefined | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ClientProfile() {
  const { user, profile } = useAuth();
  const [locationOn, setLocationOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);
  const [busy, setBusy] = useState<null | "location">(null);
  const [editSignal, setEditSignal] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("profiles")
      .select("location_enabled")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setLocationOn(Boolean(data?.location_enabled)));
  }, [user?.id]);

  useEffect(() => {
    try {
      setMarketingOn(localStorage.getItem("relink.marketing") === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);

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

  function toggleMarketing(next: boolean) {
    setMarketingOn(next);
    try {
      localStorage.setItem("relink.marketing", next ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* En-tête identité */}
      <section className="surface flex items-center gap-4 p-5">
        <AvatarPhoto
          url={profile?.avatar_url}
          name={profile?.full_name}
          className="size-16 shrink-0 rounded-full object-cover"
          fallbackClassName="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{profile?.full_name || "Mon compte"}</h1>
          <p className="truncate text-xs text-muted-foreground">{profile?.email ?? ""}</p>
          {profile?.phone ? (
            <p className="truncate text-xs text-muted-foreground">{profile.phone}</p>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 min-h-10"
            onClick={() => setEditSignal((v) => v + 1)}
          >
            Modifier mon profil
          </Button>
        </div>
      </section>

      <PersonalInfoSection openSignal={editSignal} />

      <SecuritySection />

      {/* Paiements et factures */}
      <section className="surface p-5">
        <h2 className="text-base font-semibold">Mon activité sur ReLink</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ReLink n'organise ni ne facture aucune course. Le tarif, le règlement et les conditions se
          conviennent directement avec le chauffeur.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          <li className="flex min-h-12 items-center gap-2 text-muted-foreground">
            <CreditCard className="size-4" />
            <span className="text-xs">Aucun paiement ne transite par ReLink.</span>
          </li>
        </ul>
      </section>

      {/* Préférences */}
      <section className="surface p-5">
        <h2 className="text-base font-semibold">Préférences</h2>

        <div className="mt-3"></div>

        <div className="mt-4 flex items-start justify-between gap-4 border-t border-border pt-4">
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

        <div className="mt-4 flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium">Communications commerciales</p>
            <p className="text-xs text-muted-foreground">
              Facultatif. Les messages liés au suivi d'une course et à vos factures restent toujours
              envoyés, car ils sont indispensables au service.
            </p>
          </div>
          <Switch
            checked={marketingOn}
            onCheckedChange={toggleMarketing}
            aria-label="Recevoir les communications commerciales"
          />
        </div>
      </section>

      <SupportSection />

      {/* Informations légales */}
      <section className="surface p-5">
        <h2 className="text-base font-semibold">Informations légales</h2>
        <ul className="mt-2 divide-y divide-border text-sm">
          {LEGAL_LINKS.map((l) => (
            <li key={l.doc}>
              <Link
                to="/legal/$doc"
                params={{ doc: l.doc }}
                className="flex min-h-12 items-center justify-between gap-3 font-medium"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" /> {l.label}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <AccountSection />
    </div>
  );
}
