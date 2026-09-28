/**
 * Centre de contrôle des chauffeurs ReLink : liste administrative complète
 * (identité, contact, zone, inscription, statut de compte, abonnement,
 * validation) avec recherche, filtres et accès à la fiche de gestion.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Search, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { VERIFICATION_LABELS, formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanBadge } from "@/components/admin/SubscriptionAdminCard";
import {
  BILLING_STATUS_LABELS,
  normalizeBillingStatus,
  type BillingStatus,
} from "@/lib/subscription";
import { BOOKING_THEMES } from "@/lib/booking-themes";

export const Route = createFileRoute("/_authenticated/admin/chauffeurs/")({
  head: () => ({
    meta: [
      { title: "Chauffeurs — Administration ReLink" },
      {
        name: "description",
        content:
          "Centre de contrôle des chauffeurs ReLink : comptes, validation, abonnements Gratuit ou Pro et actions administratives.",
      },
      { property: "og:title", content: "Chauffeurs — Administration ReLink" },
      {
        property: "og:description",
        content: "Gestion complète des comptes chauffeurs ReLink depuis une seule page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDrivers,
});

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  email_unverified: "E-mail non vérifié",
  phone_unverified: "Téléphone non vérifié",
  restricted: "Restreint",
  suspended: "Suspendu",
  deleted: "Supprimé",
};

type DriverFilter =
  | "all"
  | "free"
  | "pro"
  | "pending"
  | "active"
  | "suspended"
  | "complimentary"
  | "trial"
  | "past_due";

const FILTERS: { key: DriverFilter; label: string }[] = [
  { key: "all", label: "Tous les chauffeurs" },
  { key: "free", label: "Gratuit" },
  { key: "pro", label: "Pro" },
  { key: "pending", label: "En attente de validation" },
  { key: "active", label: "Actifs" },
  { key: "suspended", label: "Suspendus" },
  { key: "complimentary", label: "Pro offert" },
  { key: "trial", label: "Période d'essai" },
  { key: "past_due", label: "Paiement en anomalie" },
];

type DriverRow = {
  user_id: string;
  slug: string;
  city: string | null;
  zone: string | null;
  created_at: string;
  plan: "free" | "pro";
  billing_status: BillingStatus;
  verification_status: string;
  business_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  account_status: string;
  booking_theme: string;
  booking_theme_mode: "auto" | "admin";
};

const CATEGORY_LABELS: Record<string, string> = {
  relink_classic: "Vert",
  professional_blue: "Bleu",
  dynamic_red: "Rouge",
  luxury_black_gold: "Gold",
  women_for_women: "Violine",
};

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <AvatarPhoto url={url} name={name} className="size-10 shrink-0 rounded-full object-cover" />
    );
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
      {initials || "?"}
    </span>
  );
}

function AdminDrivers() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<DriverFilter>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "drivers", "directory"],
    queryFn: async (): Promise<DriverRow[]> => {
      const { data: drivers, error } = await supabase
        .from("driver_profiles")
        .select(
          "user_id, slug, city, zone, created_at, plan, billing_status, verification_status, business_name, booking_theme, booking_theme_mode",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (drivers ?? []).map((d) => d.user_id);
      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, email, phone, avatar_url, status")
            .in("id", ids)
        : { data: [] };
      return (drivers ?? []).map((d) => {
        const p = (profiles ?? []).find((x) => x.id === d.user_id);
        return {
          user_id: d.user_id,
          slug: d.slug,
          city: d.city,
          zone: d.zone,
          created_at: d.created_at,
          plan: d.plan === "pro" ? "pro" : "free",
          billing_status: normalizeBillingStatus(d.billing_status),
          verification_status: d.verification_status,
          business_name: d.business_name,
          full_name: p?.full_name || d.business_name || "Chauffeur",
          email: p?.email ?? null,
          phone: p?.phone ?? null,
          avatar_url: p?.avatar_url ?? null,
          account_status: p?.status ?? "active",
          booking_theme: d.booking_theme ?? "relink_classic",
          booking_theme_mode: d.booking_theme_mode === "admin" ? "admin" : "auto",
        };
      });
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      userId,
      decision,
    }: {
      userId: string;
      decision: "suspend" | "reinstate";
    }) => {
      const { error } = await supabase.rpc("admin_decide_driver", {
        _driver: userId,
        _decision: decision,
        _reason: "",
      });
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      toast.success(v.decision === "suspend" ? "Compte suspendu." : "Compte réactivé.");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ userId, value }: { userId: string; value: string }) => {
      const automatic = value === "__auto__";
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          booking_theme_mode: automatic ? "auto" : "admin",
          ...(automatic ? {} : { booking_theme: value }),
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catégorie mise à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "drivers", "directory"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Mise à jour impossible"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      if (
        q &&
        ![d.full_name, d.business_name, d.email, d.phone].some((v) =>
          (v ?? "").toLowerCase().includes(q),
        )
      )
        return false;
      switch (filter) {
        case "all":
          return true;
        case "free":
          return d.plan === "free";
        case "pro":
          return d.plan === "pro";
        case "pending":
          return ["pending", "under_review", "incomplete", "changes_requested"].includes(
            d.verification_status,
          );
        case "active":
          return d.verification_status === "verified" && d.account_status === "active";
        case "suspended":
          return d.verification_status === "suspended" || d.account_status === "suspended";
        default:
          return d.billing_status === filter;
      }
    });
  }, [data, search, filter]);

  return (
    <div>
      <PageHeader
        title="Chauffeurs"
        description="Centre de contrôle des comptes chauffeurs : validation, abonnement Gratuit ou Pro, documents et activité."
      />

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un nom, un e-mail, un téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs ${filter === f.key ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !rows.length ? (
        <EmptyState
          title="Aucun chauffeur"
          description="Aucun chauffeur ne correspond à cette recherche."
        />
      ) : (
        <>
          {/* Tableau (écrans larges) */}
          <div className="surface hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Chauffeur</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Zone</th>
                  <th className="px-4 py-3 font-medium">Inscription</th>
                  <th className="px-4 py-3 font-medium">Compte</th>
                  <th className="px-4 py-3 font-medium">Abonnement</th>
                  <th className="px-4 py-3 font-medium">Validation</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr
                    key={d.user_id}
                    onClick={() =>
                      void navigate({
                        to: "/admin/chauffeurs/$driverId",
                        params: { driverId: d.user_id },
                      })
                    }
                    className="cursor-pointer border-b border-border/60 transition last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={d.full_name} url={d.avatar_url} />
                        <div className="min-w-0">
                          <p className="font-medium">{d.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.business_name || `/chauffeur/${d.slug}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs">{d.email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{d.phone ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{d.city || d.zone || "—"}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.account_status} labels={ACCOUNT_STATUS_LABELS} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <PlanBadge plan={d.plan} />
                        <span className="text-[11px] text-muted-foreground">
                          {BILLING_STATUS_LABELS[d.billing_status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.verification_status} labels={VERIFICATION_LABELS} />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex flex-wrap items-end justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="grid gap-1 text-left text-[11px] text-muted-foreground">
                          Catégorie
                          <select
                            className="h-9 min-w-36 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                            value={d.booking_theme_mode === "auto" ? "__auto__" : d.booking_theme}
                            disabled={updateCategory.isPending}
                            onChange={(e) =>
                              updateCategory.mutate({ userId: d.user_id, value: e.target.value })
                            }
                          >
                            <option value="__auto__">Automatique</option>
                            {BOOKING_THEMES.map((theme) => (
                              <option key={theme.id} value={theme.id}>
                                {CATEGORY_LABELS[theme.id] ?? theme.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/chauffeur/$slug" params={{ slug: d.slug }} target="_blank">
                            <ExternalLink className="size-4" /> Vitrine
                          </Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link to="/admin/chauffeurs/$driverId" params={{ driverId: d.user_id }}>
                            <UserCog className="size-4" /> Voir / Gérer
                          </Link>
                        </Button>
                        {d.verification_status === "suspended" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            onClick={() =>
                              decide.mutate({ userId: d.user_id, decision: "reinstate" })
                            }
                          >
                            Réactiver
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={decide.isPending}
                            onClick={() =>
                              decide.mutate({ userId: d.user_id, decision: "suspend" })
                            }
                          >
                            Suspendre
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Liste (mobile / tablette) */}
          <div className="space-y-3 lg:hidden">
            {rows.map((d) => (
              <div
                key={d.user_id}
                className="surface p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    void navigate({
                      to: "/admin/chauffeurs/$driverId",
                      params: { driverId: d.user_id },
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void navigate({
                        to: "/admin/chauffeurs/$driverId",
                        params: { driverId: d.user_id },
                      });
                  }}
                  className="flex cursor-pointer items-start gap-3 text-left"
                >
                  <Avatar name={d.full_name} url={d.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.email ?? "—"} · {d.phone ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.city || d.zone || "Zone non renseignée"} · inscrit le{" "}
                      {formatDate(d.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PlanBadge plan={d.plan} />
                      <StatusBadge status={d.verification_status} labels={VERIFICATION_LABELS} />
                      <StatusBadge status={d.account_status} labels={ACCOUNT_STATUS_LABELS} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-[11px] text-muted-foreground">
                    Catégorie
                    <select
                      className="h-9 min-w-36 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                      value={d.booking_theme_mode === "auto" ? "__auto__" : d.booking_theme}
                      disabled={updateCategory.isPending}
                      onChange={(e) =>
                        updateCategory.mutate({ userId: d.user_id, value: e.target.value })
                      }
                    >
                      <option value="__auto__">Automatique</option>
                      {BOOKING_THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {CATEGORY_LABELS[theme.id] ?? theme.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/chauffeur/$slug" params={{ slug: d.slug }} target="_blank">
                      <ExternalLink className="size-4" /> Vitrine
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      void navigate({
                        to: "/admin/chauffeurs/$driverId",
                        params: { driverId: d.user_id },
                      })
                    }
                  >
                    <UserCog className="size-4" /> Voir / Gérer
                  </Button>
                  {d.verification_status === "suspended" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decide.mutate({ userId: d.user_id, decision: "reinstate" })}
                    >
                      Réactiver
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decide.mutate({ userId: d.user_id, decision: "suspend" })}
                    >
                      Suspendre
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
