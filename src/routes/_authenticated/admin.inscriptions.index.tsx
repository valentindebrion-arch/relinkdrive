import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Loader2 } from "lucide-react";
import { listDriverApplications } from "@/lib/admin-dossier.functions";
import { APPLICATION_STATUS_LABELS, DRIVER_KIND_LABELS } from "@/lib/driver-application";
import { PageHeader } from "@/components/Ui";
import { formatDateTime } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/admin/inscriptions/")({
  head: () => ({
    meta: [
      { title: "Demande inscription chauffeur — ReLink" },
      {
        name: "description",
        content:
          "Suivi et validation des demandes d'inscription des chauffeurs professionnels sur ReLink.",
      },
      { property: "og:title", content: "Demande inscription chauffeur — ReLink" },
      {
        property: "og:description",
        content: "Espace administrateur ReLink dédié aux demandes d'inscription chauffeur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicationsPage,
});

function statusTone(status: string) {
  if (status === "verified") return "bg-primary/10 text-primary";
  if (["rejected", "suspended", "changes_requested", "expired_documents"].includes(status))
    return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function ApplicationsPage() {
  const list = useServerFn(listDriverApplications);
  const q = useQuery({ queryKey: ["driver-applications"], queryFn: () => list({}) });
  const [tab, setTab] = useState<"pending" | "validated">("pending");

  const all = q.data ?? [];
  const validated = all.filter((a) => a.status === "verified");
  const pending = all.filter((a) => a.status !== "verified");
  const rows = tab === "validated" ? validated : pending;

  return (
    <>
      <PageHeader
        title="Demande inscription chauffeur"
        description="Dossiers transmis par les chauffeurs pour vérification professionnelle."
      />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {([
          ["pending", "En attente", pending.length],
          ["validated", "Validé", validated.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === key ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="surface flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !rows.length ? (
        <p className="surface p-6 text-sm text-muted-foreground">
          {tab === "validated"
            ? "Aucun dossier validé pour le moment."
            : "Aucune demande en attente."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Link
              key={a.driverId}
              to="/admin/inscriptions/$driverId"
              params={{ driverId: a.driverId }}
              className="surface tap-active flex items-center justify-between gap-3 p-4"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {a.lastName ? `${a.lastName.toUpperCase()} ${a.firstName}` : a.fullName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {DRIVER_KIND_LABELS[a.kind] ?? a.kind} · {a.number ?? "numéro non renseigné"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Envoyé le {formatDateTime(a.submittedAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(a.status)}`}
                >
                  {APPLICATION_STATUS_LABELS[a.status] ?? a.status}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
