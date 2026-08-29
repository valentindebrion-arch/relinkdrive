import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Car,
  Eye,
  Heart,
  Link2,
  MousePointerClick,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle } from "@/lib/driver-queries";
import { isDriverActive } from "@/lib/driver-dossier";
import { PageHeader } from "@/components/Ui";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/pro/")({
  component: ProOverview,
});

type ChecklistItem = { label: string; done: boolean; to: string };

function StatCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="surface flex min-w-0 flex-col gap-1 p-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function ProOverview() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const vehicle = useMyVehicle();
  const d = driver.data;
  const verified = isDriverActive(d?.verification_status);

  const stats = useQuery({
    queryKey: ["driver-visibility-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_driver_visibility_stats", { _days: 30 });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const checklist: ChecklistItem[] = [
    { label: "Photo de profil", done: !!profile?.avatar_url, to: "/pro/profil" },
    { label: "Présentation publique", done: !!d?.public_intro, to: "/pro/profil" },
    { label: "Secteur d'activité", done: !!(d?.city || d?.zone), to: "/pro/profil" },
    { label: "Prestations proposées", done: (d?.services ?? []).length > 0, to: "/pro/profil" },
    { label: "Langues parlées", done: (d?.languages ?? []).length > 0, to: "/pro/profil" },
    { label: "Véhicule et photos", done: !!vehicle.data?.photo_url, to: "/pro/vehicule" },
    { label: "Informations tarifaires", done: !!d?.pro_tariff_snapshot || true, to: "/pro/tarification" },
    { label: "Moyens de contact", done: !!(d?.public_phone || d?.whatsapp_number), to: "/pro/liens" },
  ];
  const done = checklist.filter((c) => c.done).length;
  const completion = Math.round((done / checklist.length) * 100);

  const shortcuts = [
    { to: "/pro/profil", label: "Mon profil", icon: UserRound },
    { to: "/pro/vehicule", label: "Mes véhicules", icon: Car },
    { to: "/pro/tarification", label: "Mes tarifs", icon: SlidersHorizontal },
    { to: "/pro/liens", label: "Mes liens", icon: Link2 },
    { to: "/pro/qr", label: "Mon QR code", icon: QrCode },
    { to: "/pro/dossier", label: "Vérification", icon: ShieldCheck },
  ];

  return (
    <>
      <PageHeader
        title="Ma vitrine"
        description={`Votre présence sur ${BRAND.name} : profil, véhicules, prestations et coordonnées.`}
      />

      {verified && d?.slug ? (
        <Link
          to="/chauffeur/$slug"
          params={{ slug: d.slug }}
          className="surface mb-4 flex items-center justify-between gap-3 p-4"
        >
          <div className="min-w-0">
            <p className="font-medium">Voir ma vitrine publique</p>
            <p className="truncate text-sm text-muted-foreground">/chauffeur/{d.slug}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <div className="surface mb-4 flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium">Vitrine pas encore publiée</p>
            <p className="text-sm text-muted-foreground">
              Votre profil sera visible dans l'annuaire une fois votre dossier vérifié.
            </p>
          </div>
          <Link to="/pro/dossier" className="shrink-0 text-sm font-medium text-primary">
            Mon dossier
          </Link>
        </div>
      )}

      <section className="surface mb-4 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Complétude de mon profil</h2>
          <span className="text-sm font-bold tabular-nums text-primary">{completion} %</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} />
        </div>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {checklist.map((c) => (
            <li key={c.label}>
              <Link
                to={c.to}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    c.done ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.done ? "OK" : "À compléter"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 font-semibold">Ma visibilité · 30 derniers jours</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard icon={Eye} label="Vues du profil" value={Number(stats.data?.profile_views ?? 0)} />
          <StatCard icon={ShieldCheck} label="Apparitions" value={Number(stats.data?.search_appearances ?? 0)} />
          <StatCard icon={Heart} label="Ajouts au réseau" value={Number(stats.data?.network_adds ?? 0)} />
          <StatCard icon={MousePointerClick} label="Clics contact" value={Number(stats.data?.contact_clicks ?? 0)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Statistiques de visibilité uniquement. {BRAND.name} ne suit aucune course ni aucun chiffre d'affaires.
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Gérer ma présence</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((s) => (
            <Link key={s.to} to={s.to} className="surface flex items-center gap-3 p-4 hover:bg-muted/40">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
