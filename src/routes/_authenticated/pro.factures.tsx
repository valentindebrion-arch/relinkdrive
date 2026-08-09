import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Search, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { PageHeader, EmptyState, StatCard } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { INVOICE_LABELS, formatDate, formatEuro } from "@/lib/labels";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/pro/factures")({
  component: DriverInvoices,
});

type Invoice = {
  id: string;
  number: string;
  status: string;
  amount_ht: number;
  amount_ttc: number;
  vat_rate: number;
  description: string | null;
  issued_on: string;
  ride_id: string | null;
  client_id: string | null;
  payment_method: string | null;
  due_on: string | null;
};

type Period = "week" | "month" | "year";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function rangeFor(period: Period, offset: number) {
  const now = new Date();
  if (period === "week") {
    const start = startOfWeek(now);
    start.setDate(start.getDate() + offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    return { start, end };
  }
  const start = new Date(now.getFullYear() + offset, 0, 1);
  const end = new Date(now.getFullYear() + offset + 1, 0, 1);
  return { start, end };
}

function labelFor(period: Period, start: Date, end: Date) {
  if (period === "week") {
    const last = new Date(end);
    last.setDate(last.getDate() - 1);
    const sameMonth = last.getMonth() === start.getMonth();
    const a = start.toLocaleDateString("fr-FR", sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" });
    const b = last.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return `Du ${a} au ${b}`;
  }
  if (period === "month") {
    const l = start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return l.charAt(0).toUpperCase() + l.slice(1);
  }
  return `Année ${start.getFullYear()}`;
}

function FigureCard({
  label,
  amount,
  hint,
  className,
}: {
  label: string;
  amount: number;
  hint?: string;
  className?: string;
}) {
  const text = formatEuro(amount);
  const size =
    text.length > 13
      ? "text-base"
      : text.length > 10
        ? "text-lg"
        : text.length > 8
          ? "text-xl"
          : "text-2xl";
  return (
    <div className={`surface min-w-0 overflow-hidden p-3 sm:p-4 ${className ?? ""}`}>
      <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1.5 whitespace-nowrap font-semibold tabular-nums ${size}`}>
        <span className="block origin-left truncate">{text}</span>
      </p>
      {hint ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DriverInvoices() {

  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");

  const invoices = useQuery({
    queryKey: ["driver-invoices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("driver_id", user!.id)
        .order("issued_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invoice[];
    },
  });

  const list = useMemo(() => invoices.data ?? [], [invoices.data]);

  const clientIds = useMemo(
    () => Array.from(new Set(list.map((i) => i.client_id).filter(Boolean) as string[])),
    [list],
  );

  const clients = useQuery({
    queryKey: ["invoice-clients", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", clientIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.full_name ?? "";
      return map;
    },
  });

  const clientName = (inv: Invoice) => (inv.client_id ? clients.data?.[inv.client_id] || "" : "");

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
    void qc.invalidateQueries({ queryKey: ["driver-data"] });
  }

  async function setStatus(inv: Invoice, status: "sent" | "paid" | "cancelled" | "issued") {
    const { error } = await supabase
      .from("invoices")
      .update({ status: status as never, ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}) })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (status === "paid") {
      await supabase.from("payments").insert({
        invoice_id: inv.id,
        driver_id: user!.id,
        amount: Number(inv.amount_ttc),
        method: inv.payment_method ?? "cash",
      });
    }
    refresh();
  }

  async function finalize(inv: Invoice) {
    const value = window.prompt("Montant HT définitif (€)", String(inv.amount_ht || ""));
    if (value == null) return;
    const ht = Number(value);
    if (!ht) {
      toast.error("Montant invalide");
      return;
    }
    const { error } = await supabase
      .from("invoices")
      .update({
        amount_ht: ht,
        amount_ttc: Math.round(ht * (1 + Number(inv.vat_rate) / 100) * 100) / 100,
        status: "issued" as never,
      })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Facture finalisée");
    refresh();
  }

  async function download(inv: Invoice) {
    let ride: { pickup_address?: string | null; dropoff_address?: string | null; scheduled_at?: string | null; completed_at?: string | null; passengers?: number | null; mileage_km?: number | string | null } | null = null;
    let client: { full_name?: string | null; email?: string | null; phone?: string | null } | null = null;
    if (inv.ride_id) {
      const { data } = await supabase
        .from("rides")
        .select("pickup_address, dropoff_address, scheduled_at, completed_at, passengers, mileage_km, client_id")
        .eq("id", inv.ride_id)
        .maybeSingle();
      if (data) {
        ride = data;
        if (data.client_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("full_name, email, phone")
            .eq("id", data.client_id)
            .maybeSingle();
          client = p ?? null;
        }
      }
    }
    downloadInvoicePdf({
      invoice: inv as never,
      issuer: {
        full_name: profile?.full_name ?? null,
        business_name: driver.data?.business_name ?? null,
        siret: driver.data?.siret ?? null,
        vtc_card_number: driver.data?.vtc_card_number ?? null,
        professional_address: driver.data?.professional_address ?? null,
        billing_legal_info: driver.data?.billing_legal_info ?? null,
        vat_applicable: driver.data?.vat_applicable ?? false,
        public_phone: driver.data?.public_phone ?? null,
        email: profile?.email ?? null,
      },
      client,
      ride,
    });
  }

  function exportCsv(rowsList: Invoice[]) {
    const rows = [
      ["Numero", "Date", "Client", "Description", "HT", "TVA", "TTC", "Statut"],
      ...rowsList.map((i) => [
        i.number,
        i.issued_on,
        clientName(i).replace(/;/g, ","),
        (i.description ?? "").replace(/;/g, ","),
        String(i.amount_ht),
        String(i.vat_rate),
        String(i.amount_ttc),
        INVOICE_LABELS[i.status] ?? i.status,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "factures-relink.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const { start, end } = rangeFor(period, offset);
  const inRange = (value: string | null | undefined) => {
    if (!value) return false;
    const d = new Date(value);
    return d >= start && d < end;
  };

  const periodInvoices = list.filter((i) => inRange(i.issued_on));
  const billed = periodInvoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const paidList = billed.filter((i) => i.status === "paid");
  const toCollect = billed.filter((i) => i.status !== "paid");
  const drafts = periodInvoices.filter((i) => i.status === "draft");
  const sum = (arr: Invoice[]) => arr.reduce((s, i) => s + Number(i.amount_ttc), 0);

  const inPeriod = [...periodInvoices].sort(
    (a, b) => new Date(b.issued_on).getTime() - new Date(a.issued_on).getTime(),
  );


  const q = search.trim().toLowerCase();
  const shown = q
    ? inPeriod.filter((i) =>
        [i.number, clientName(i), formatDate(i.issued_on), i.issued_on, i.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : inPeriod;

  return (
    <>
      <PageHeader title="Facturation" description="Vos factures se créent automatiquement à la fin de chaque course." />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        <FigureCard label="CA facturé" amount={sum(billed)} hint={`${billed.length} facture(s)`} />
        <FigureCard label="CA encaissé" amount={sum(paidList)} hint={`${paidList.length} payée(s)`} />
        <FigureCard
          label="Reste à encaisser"
          amount={sum(toCollect)}
          hint={`${toCollect.length} en attente`}
          className="col-span-2 sm:col-span-1"
        />
      </div>


      {drafts.length ? (
        <div className="surface mb-4 border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">
            {drafts.length} brouillon(s) à compléter — ces documents ne sont pas des factures définitives.
          </p>
          <p className="mt-1 text-muted-foreground">
            Renseignez le montant final pour les finaliser et les envoyer au client.
          </p>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Toutes les factures</h2>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost" aria-label="Statistiques">
            <Link to="/pro/activite">
              <BarChart3 className="size-4" />
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv(shown)}>
            <Download className="mr-1 size-4" /> Export
          </Button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9"
          placeholder="Rechercher une facture"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-3 space-y-2">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
          {([["week", "Semaine"], ["month", "Mois"], ["year", "Année"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPeriod(key);
                setOffset(0);
              }}
              className={`tap-active h-9 rounded-xl text-sm font-medium transition-colors ${
                period === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button size="icon" variant="outline" aria-label="Période précédente" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="truncate text-sm font-medium">{labelFor(period, start, end)}</p>
          <Button size="icon" variant="outline" aria-label="Période suivante" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {invoices.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface h-24 animate-pulse p-4" />
          ))}
        </div>
      ) : invoices.isError ? (
        <EmptyState title="Impossible de charger vos factures" />
      ) : shown.length === 0 ? (
        q ? (
          <EmptyState title="Aucune facture ne correspond à votre recherche." />
        ) : (
          <EmptyState
            title="Aucune facture pour cette période."
            description="Les factures de vos courses terminées apparaîtront automatiquement ici."
          />
        )
      ) : (
        <div className="space-y-3">
          {shown.map((inv) => (
            <div key={inv.id} className="surface p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{clientName(inv) || inv.description || "Client"}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(inv.issued_on)}</p>
                  <p className="truncate text-xs text-muted-foreground">Facture n° {inv.number}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">{formatEuro(Number(inv.amount_ttc))}</p>
                </div>
                <StatusBadge status={inv.status} labels={INVOICE_LABELS} />
              </div>
              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                {inv.status === "draft" ? (
                  <Button size="sm" className="shrink-0" onClick={() => finalize(inv)}>
                    Compléter
                  </Button>
                ) : null}
                {inv.status === "issued" ? (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setStatus(inv, "sent")}>
                    Envoyée
                  </Button>
                ) : null}
                {!["paid", "cancelled", "draft"].includes(inv.status) ? (
                  <Button size="sm" className="shrink-0" onClick={() => setStatus(inv, "paid")}>
                    Payée
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => download(inv)}>
                  <Download className="mr-1 size-4" /> Télécharger
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
