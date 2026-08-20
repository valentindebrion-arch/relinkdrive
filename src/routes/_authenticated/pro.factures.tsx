import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Search, BarChart3, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfile, fetchConnectedProfiles } from "@/lib/connected-profiles";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { PageHeader, EmptyState } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { INVOICE_LABELS, formatDate, formatEuro } from "@/lib/labels";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { openArchivedInvoicePdf } from "@/lib/invoice-archive";
import { InvoiceIssueDialog, type DraftInvoice } from "@/components/pro/InvoiceIssueDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/pro/factures")({
  component: DriverInvoices,
});

type Invoice = {
  id: string;
  number: string | null;
  document_type?: string | null;
  pdf_path?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  customer_id?: string | null;
  passenger_name?: string | null;
  service_date?: string | null;
  quantity?: number | null;
  unit_price_ht?: number | null;
  tax_regime?: string | null;
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
  const [issuing, setIssuing] = useState<DraftInvoice | null>(null);
  const [tab, setTab] = useState<"drafts" | "issued" | "credits">("drafts");

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
      const data = await fetchConnectedProfiles(clientIds);
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

  async function markSent(inv: Invoice) {
    const { error } = await supabase.from("invoices").update({ status: "sent" as never }).eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  async function recordPayment(inv: Invoice) {
    const due = Number(inv.amount_due ?? inv.amount_ttc);
    const value = window.prompt("Montant encaisse (EUR)", String(due || ""));
    if (value == null) return;
    const amount = Number(value.replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    const { error } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc("record_invoice_payment", {
      _invoice_id: inv.id,
      _amount: amount,
      _method: inv.payment_method ?? "cash",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Encaissement enregistre");
    refresh();
  }

  async function creditNote(inv: Invoice) {
    const reason = window.prompt("Motif de l'avoir (obligatoire)");
    if (!reason?.trim()) return;
    const { error } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc("create_credit_note", { _invoice_id: inv.id, _reason: reason.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Avoir cree");
    refresh();
  }

  async function download(inv: Invoice) {
    if (inv.pdf_path && (await openArchivedInvoicePdf(inv.pdf_path))) return;
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
          const p = await fetchConnectedProfile(data.client_id);
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
      ["Numero", "Date", "Client", "Description", "Regime", "HT", "Taux TVA", "TVA", "TTC", "Statut"],
      ...rowsList.map((i) => [
        i.number ?? "",
        i.issued_on,
        clientName(i).replace(/;/g, ","),
        (i.description ?? "").replace(/;/g, ","),
        (i as { tax_regime?: string | null }).tax_regime === "liable" ? "Redevable" : "Franchise",
        String(i.amount_ht),
        (i as { tax_regime?: string | null }).tax_regime === "liable" ? String(i.vat_rate) : "",
        (i as { tax_regime?: string | null }).tax_regime === "liable"
          ? String(Math.round((Number(i.amount_ttc) - Number(i.amount_ht)) * 100) / 100)
          : "",
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


  // Les brouillons ne sont pas limités à la période : ils doivent toujours être
  // visibles tant qu'ils ne sont pas émis.
  const allDrafts = list.filter((i) => i.status === "draft");
  const tabList =
    tab === "drafts"
      ? allDrafts
      : tab === "credits"
        ? inPeriod.filter((i) => i.document_type === "credit_note")
        : inPeriod.filter((i) => i.status !== "draft" && i.document_type !== "credit_note");

  const q = search.trim().toLowerCase();
  const shown = q
    ? tabList.filter((i) =>
        [i.number ?? "", clientName(i), formatDate(i.issued_on), i.issued_on, i.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : tabList;

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
            {drafts.length} brouillon(s) en attente — ce ne sont pas encore des factures.
          </p>
          <p className="mt-1 text-muted-foreground">
            Vérifiez le client facturé puis émettez la facture en un clic.
          </p>
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {(
          [
            ["drafts", `Brouillons${allDrafts.length ? ` (${allDrafts.length})` : ""}`],
            ["issued", "Factures"],
            ["credits", "Avoirs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`tap-active h-9 rounded-xl text-sm font-medium transition-colors ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-end gap-1">
        <Button asChild size="sm" variant="ghost" aria-label="Statistiques">
          <Link to="/pro/activite">
            <BarChart3 className="size-4" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" aria-label="Clients facturés">
          <Link to="/pro/clients-factures">
            <Users className="size-4" />
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportCsv(shown)}>
          <Download className="mr-1 size-4" /> Export
        </Button>
      </div>

      {tab === "drafts" ? null : (
        <>
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
        </>
      )}

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
            title={
              tab === "drafts"
                ? "Aucun brouillon en attente."
                : tab === "credits"
                  ? "Aucun avoir sur cette période."
                  : "Aucune facture sur cette période."
            }
            description="Les documents de vos courses terminées apparaissent automatiquement ici."
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
                  <p className="truncate text-xs text-muted-foreground">
                    {inv.number
                      ? `${inv.document_type === "credit_note" ? "Avoir" : "Facture"} n° ${inv.number}`
                      : "Brouillon"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-primary">{formatEuro(Number(inv.amount_ttc))}</p>
                </div>
                <StatusBadge status={inv.status} labels={INVOICE_LABELS} />
              </div>
              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                {inv.status === "draft" ? (
                  <Button size="sm" className="shrink-0" onClick={() => setIssuing(inv as DraftInvoice)}>
                    Émettre la facture
                  </Button>
                ) : null}
                {inv.status === "issued" ? (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => void markSent(inv)}>
                    Envoyée
                  </Button>
                ) : null}
                {!["paid", "cancelled", "draft", "credited"].includes(inv.status) ? (
                  <Button size="sm" className="shrink-0" onClick={() => void recordPayment(inv)}>
                    Encaissement
                  </Button>
                ) : null}
                {inv.number && inv.document_type !== "credit_note" && inv.status !== "credited" ? (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => void creditNote(inv)}>
                    Avoir
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => void download(inv)}>
                  <Download className="mr-1 size-4" /> Télécharger
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <InvoiceIssueDialog
        invoice={issuing}
        open={!!issuing}
        onOpenChange={(v) => {
          if (!v) setIssuing(null);
        }}
      />
    </>
  );
}
