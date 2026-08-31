/** Support ReLink — liste des tickets SAV (clients et chauffeurs). */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAllTickets } from "@/lib/support-queries";
import {
  SUPPORT_STATUS_LABELS,
  USER_KIND_LABELS,
  supportStatusTone,
  type SupportStatus,
} from "@/lib/support";
import { formatDateTime } from "@/lib/labels";
import { EmptyState, PageHeader, StatCard } from "@/components/Ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/support/")({
  head: () => ({
    meta: [
      { title: "Support — Administration ReLink" },
      {
        name: "description",
        content:
          "Traitement des demandes SAV envoyées par les clients et chauffeurs ReLink depuis l'application.",
      },
      { property: "og:title", content: "Support — Administration ReLink" },
      { property: "og:description", content: "Tickets SAV ReLink." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSupport,
});

const TONE_CLASS: Record<string, string> = {
  info: "bg-accent text-accent-foreground",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-destructive/15 text-destructive",
};

type StatusFilter = "all" | SupportStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "new", label: "Nouveaux" },
  { key: "in_progress", label: "En cours" },
  { key: "waiting_user", label: "En attente utilisateur" },
  { key: "resolved", label: "Résolus" },
];

function AdminSupport() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<"all" | "client" | "driver">("all");
  const [search, setSearch] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin", "support", "tickets"],
    queryFn: listAllTickets,
  });

  const userIds = useMemo(
    () => Array.from(new Set((tickets ?? []).map((t) => t.user_id))),
    [tickets],
  );

  const { data: people } = useQuery({
    queryKey: ["admin", "support", "people", userIds.length],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map = new Map<string, { full_name: string; email: string | null }>();
      (data ?? []).forEach((p) => map.set(p.id, { full_name: p.full_name, email: p.email }));
      return map;
    },
  });

  const rows = (tickets ?? []).filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (kind !== "all" && t.user_kind !== kind) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const person = people?.get(t.user_id);
    return [
      String(t.ticket_number),
      t.subject,
      t.category,
      t.status,
      person?.full_name ?? "",
      person?.email ?? "",
    ].some((v) => v.toLowerCase().includes(q));
  });

  const counts = {
    new: (tickets ?? []).filter((t) => t.status === "new").length,
    in_progress: (tickets ?? []).filter((t) => t.status === "in_progress").length,
    resolved: (tickets ?? []).filter((t) => t.status === "resolved").length,
  };

  return (
    <div>
      <PageHeader
        title="Support"
        description="Demandes SAV des clients et chauffeurs ReLink. Aucune messagerie entre utilisateurs."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Nouveaux tickets" value={counts.new} />
        <StatCard label="En cours" value={counts.in_progress} />
        <StatCard label="Résolus" value={counts.resolved} />
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Numéro, nom, e-mail, mot-clé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={status === f.key ? "default" : "outline"}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "client", "driver"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? "secondary" : "ghost"}
              onClick={() => setKind(k)}
            >
              {k === "all" ? "Tous les comptes" : `${USER_KIND_LABELS[k]}s`}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <div className="space-y-2">
          {rows.map((t) => {
            const person = people?.get(t.user_id);
            return (
              <Link
                key={t.id}
                to="/admin/support/$ticketId"
                params={{ ticketId: t.id }}
                className="surface flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    #{t.ticket_number} — {t.subject}
                    {t.admin_unread ? (
                      <span className="ml-2 inline-block size-2 rounded-full bg-primary align-middle" />
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {person?.full_name ?? "Compte"} · {USER_KIND_LABELS[t.user_kind]} ·{" "}
                    {formatDateTime(t.last_message_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[supportStatusTone(t.status)]}`}
                >
                  {SUPPORT_STATUS_LABELS[t.status]}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
