import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Building2,
  Car,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  QrCode,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyDocuments, useMyVehicle } from "@/lib/driver-queries";
import { DOCUMENT_TYPES, VERIFICATION_LABELS } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProSettings } from "@/components/pro/ProSettings";
import { CompanyPage } from "@/components/pro/CompanyPage";
import { VehiclePage } from "@/components/pro/VehiclePage";
import { VerificationPage } from "@/components/pro/VerificationPage";
import { QrPage } from "@/components/pro/QrPage";

export const Route = createFileRoute("/_authenticated/pro/profil")({
  component: ProProfileHub,
});

type SectionKey = "compte" | "entreprise" | "vehicule" | "verification" | "qr";

type Search = { section?: SectionKey };

const SECTION_TITLES: Record<SectionKey, string> = {
  compte: "Informations personnelles",
  entreprise: "Entreprise",
  vehicule: "Véhicule",
  verification: "Documents et vérification",
  qr: "Page publique et QR code",
};

function ratio(values: Array<unknown>) {
  const filled = values.filter((v) => (Array.isArray(v) ? v.length > 0 : !!v)).length;
  return { filled, total: values.length, pct: Math.round((filled / Math.max(values.length, 1)) * 100) };
}

function SectionBadge({ pct }: { pct: number }) {
  return (
    <StatusBadge
      status={pct === 100 ? "verified" : pct === 0 ? "incomplete" : "pending"}
      labels={{ verified: "Complet", incomplete: "À compléter", pending: `${pct} %` }}
    />
  );
}

function SectionCard({
  icon,
  title,
  lines,
  badge,
  onClick,
  extra,
  status = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  badge: React.ReactNode;
  onClick: () => void;
  extra?: React.ReactNode;
  status?: "neutral" | "warning" | "danger";
}) {
  const statusClass =
    status === "danger"
      ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
      : status === "warning"
        ? "border-warning/40 bg-warning/10 hover:border-warning/60"
        : "hover:border-primary/40";
  const iconClass =
    status === "danger"
      ? "bg-destructive/10 text-destructive"
      : status === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface tap-active w-full p-4 text-left transition ${statusClass}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{title}</p>
            {badge}
          </div>
          {lines.filter(Boolean).map((l) => (
            <p key={l} className="mt-0.5 truncate text-xs text-muted-foreground">
              {l}
            </p>
          ))}
          {extra}
        </div>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}

function ProProfileHub() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const vehicle = useMyVehicle();
  const docs = useMyDocuments();
  const search = useSearch({ from: "/_authenticated/pro/profil" }) as Search;
  const navigate = useNavigate({ from: "/_authenticated/pro/profil" });
  const [section, setSectionState] = useState<SectionKey | null>(search.section ?? null);
  const [origin, setOrigin] = useState("");
  const qrRef = useRef<HTMLCanvasElement>(null);

  function setSection(next: SectionKey | null) {
    setSectionState(next);
    void navigate({ search: (prev: Search) => ({ ...prev, section: next ?? undefined }) });
  }

  const company = useQuery({
    queryKey: ["company", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("driver_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => setOrigin(window.location.origin), []);

  const publicUrl = driver.data ? `${origin}/chauffeur/${driver.data.slug}` : "";

  useEffect(() => {
    if (!section && publicUrl && qrRef.current) {
      void QRCode.toCanvas(qrRef.current, publicUrl, { width: 96, margin: 0 });
    }
  }, [publicUrl, section]);

  const d = driver.data;
  const v = vehicle.data;
  const c = company.data;
  const docList = docs.data ?? [];

  const account = ratio([profile?.full_name, profile?.phone, d?.business_name, d?.city, d?.public_intro, d?.languages, d?.services]);
  const companyPct = ratio([c?.legal_name, c?.legal_form, c?.siret, c?.address, c?.postal_code, c?.city]);
  const vehiclePct = ratio([v?.brand, v?.model, v?.plate, v?.color, v?.year, v?.photo_url]);

  const docStats = useMemo(() => {
    const by = (s: string) => docList.filter((x) => x.status === s).length;
    return {
      approved: by("approved"),
      pending: by("pending"),
      rejected: by("rejected"),
      expired: by("expired"),
      missing: DOCUMENT_TYPES.filter((t) => !docList.some((x) => x.doc_type === t)).length,
      soon: docList.filter(
        (x) =>
          x.expires_at &&
          new Date(x.expires_at).getTime() - Date.now() < 30 * 864e5 &&
          new Date(x.expires_at).getTime() > Date.now(),
      ).length,
    };
  }, [docList]);

  const globalPct = Math.round(
    (account.pct + companyPct.pct + vehiclePct.pct + (docStats.approved / DOCUMENT_TYPES.length) * 100) / 4,
  );

  const soon = (date?: string | null) => !!date && new Date(date).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45;
  const expired = (date?: string | null) => !!date && new Date(date).getTime() < Date.now();

  const sectionStatus: Record<Exclude<SectionKey, "qr">, "neutral" | "warning" | "danger"> = {
    compte: "neutral",
    entreprise: "neutral",
    vehicule:
      expired(v?.insurance_expires_at) || expired(v?.inspection_expires_at) || expired(v?.next_service_date)
        ? "danger"
        : soon(v?.insurance_expires_at) || soon(v?.inspection_expires_at) || soon(v?.next_service_date)
          ? "warning"
          : "neutral",
    verification:
      docStats.rejected || docStats.expired || d?.verification_status === "rejected"
        ? "danger"
        : docStats.soon || d?.verification_status === "pending"
          ? "warning"
          : "neutral",
  };

  const loading = driver.isLoading || vehicle.isLoading || docs.isLoading || company.isLoading;

  if (section) {
    return (
      <div className="pb-6">
        <div className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSection(null)}>
            <ArrowLeft className="size-4" /> Retour
          </Button>
          <span className="truncate text-sm font-medium text-muted-foreground">{SECTION_TITLES[section]}</span>
        </div>
        {section === "compte" ? <ProSettings /> : null}
        {section === "entreprise" ? <CompanyPage /> : null}
        {section === "vehicule" ? <VehiclePage /> : null}
        {section === "verification" ? <VerificationPage /> : null}
        {section === "qr" ? <QrPage /> : null}
      </div>
    );
  }

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Mon profil</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Gérez vos informations et votre activité professionnelle.
        </p>
      </div>

      <div className="surface p-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{profile?.full_name ?? "—"}</p>
            {d?.business_name ? (
              <p className="truncate text-xs text-muted-foreground">{d.business_name}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={d?.verification_status ?? "incomplete"} labels={VERIFICATION_LABELS} />
              <StatusBadge
                status={d?.page_published ? "verified" : "incomplete"}
                labels={{ verified: "Page publiée", incomplete: "Page non publiée" }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {loading ? "Chargement…" : `Profil complété à ${globalPct} %`}
            </span>
            <span className="font-semibold text-primary">{loading ? "" : `${globalPct} %`}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary transition-all")}
              style={{ width: `${loading ? 0 : globalPct}%` }}
            />
          </div>
        </div>

        {publicUrl ? (
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Voir ma page publique
            </a>
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        <SectionCard
          icon={<UserRound className="size-5" />}
          title="Informations personnelles"
          badge={<SectionBadge pct={account.pct} />}
          lines={[
            profile?.full_name ?? "Nom à renseigner",
            profile?.phone ?? "Téléphone à renseigner",
            d?.city || d?.zone || "Ville / zone à renseigner",
          ]}
          onClick={() => setSection("compte")}
        />
        <SectionCard
          icon={<Building2 className="size-5" />}
          title="Entreprise"
          badge={<SectionBadge pct={companyPct.pct} />}
          lines={[
            c?.legal_name || d?.business_name || "Raison sociale à renseigner",
            c?.siret ? `SIRET ${c.siret}` : "SIRET à renseigner",
            c?.legal_form || "",
          ]}
          onClick={() => setSection("entreprise")}
        />
        <SectionCard
          icon={<Car className="size-5" />}
          title="Véhicule"
          badge={<SectionBadge pct={vehiclePct.pct} />}
          lines={[
            v?.brand || v?.model ? `${v?.brand ?? ""} ${v?.model ?? ""}`.trim() : "Véhicule à renseigner",
            v?.plate || "Immatriculation à renseigner",
            [v?.color, v?.category].filter(Boolean).join(" · "),
          ]}
          onClick={() => setSection("vehicule")}
        />
        <SectionCard
          icon={<FileCheck2 className="size-5" />}
          title="Documents et vérification"
          badge={
            <StatusBadge
              status={
                docStats.rejected || docStats.expired
                  ? "rejected"
                  : docStats.missing
                    ? "incomplete"
                    : docStats.pending
                      ? "pending"
                      : "verified"
              }
              labels={{
                rejected: docStats.expired && !docStats.rejected ? "Expiré" : "Refusé",
                incomplete: "À compléter",
                pending: "En attente",
                verified: "Validé",
              }}
            />
          }
          lines={[
            `${docStats.approved} validé${docStats.approved > 1 ? "s" : ""} · ${docStats.pending} en attente`,
            `${docStats.missing} manquant${docStats.missing > 1 ? "s" : ""} · ${docStats.rejected} refusé${docStats.rejected > 1 ? "s" : ""} · ${docStats.expired} expiré${docStats.expired > 1 ? "s" : ""}`,
            docStats.soon ? `${docStats.soon} document(s) bientôt à expiration` : "",
          ]}
          onClick={() => setSection("verification")}
        />
        <SectionCard
          icon={<QrCode className="size-5" />}
          title="Page publique et QR code"
          badge={
            <StatusBadge
              status={d?.page_published ? "verified" : "incomplete"}
              labels={{ verified: "Publiée", incomplete: "Non publiée" }}
            />
          }
          lines={[publicUrl || "Lien indisponible", "Partage, copie du lien et téléchargement du QR code"]}
          onClick={() => setSection("qr")}
          extra={
            publicUrl ? (
              <canvas ref={qrRef} className="mt-2 rounded-lg bg-white p-1" width={96} height={96} />
            ) : null
          }
        />
      </div>
    </div>
  );
}
