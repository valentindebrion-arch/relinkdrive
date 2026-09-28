import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, Link2, QrCode, Share2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { getMyPublicLink } from "@/lib/driver-qr.functions";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { driverAccentVars } from "@/lib/booking-themes";
import { cn } from "@/lib/utils";

type Stats = {
  views: number;
  unique_visitors: number;
  qr_scans: number;
  contact_clicks: number;
  adds: number;
  adds_previous: number | null;
  network_total: number;
  sources: Record<string, number>;
  series: { day: string; views: number }[];
};

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 0, label: "Tout" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  qr: "QR Code",
  discovery: "ReLink / Trouver",
  share: "Lien partagé",
  direct: "Lien direct",
  network: "Mon réseau",
};

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--driver-border,var(--border))] bg-card p-3">
      <p className="break-words text-xl font-semibold text-[color:var(--driver-primary,var(--primary))]">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function QrPage() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [days, setDays] = useState<number>(30);
  const fetchLink = useServerFn(getMyPublicLink);

  // Le lien public est délivré par le serveur uniquement si la vitrine existe.
  const link = useQuery({
    queryKey: ["my-public-link", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchLink(),
  });

  const data = link.data as
    | { available: true; url: string; qrUrl: string; slug: string }
    | { available: false }
    | undefined;
  const url = data?.available ? data.url : "";
  const qrUrl = data?.available ? data.qrUrl : "";

  // Le QR reste noir sur blanc : la lisibilité prime sur le thème.
  useEffect(() => {
    if (qrUrl && canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 240,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [qrUrl]);

  const stats = useQuery({
    queryKey: ["qr-stats", user?.id, days],
    enabled: !!user?.id,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Stats> => {
      const { data: raw, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>
      )("get_driver_qr_stats", { _days: days });
      if (error) throw new Error(error.message);
      const r = (raw ?? {}) as Partial<Stats>;
      return {
        views: Number(r.views ?? 0),
        unique_visitors: Number(r.unique_visitors ?? 0),
        qr_scans: Number(r.qr_scans ?? 0),
        contact_clicks: Number(r.contact_clicks ?? 0),
        adds: Number(r.adds ?? 0),
        adds_previous: r.adds_previous == null ? null : Number(r.adds_previous),
        network_total: Number(r.network_total ?? 0),
        sources: (r.sources ?? {}) as Record<string, number>,
        series: (r.series ?? []) as { day: string; views: number }[],
      };
    },
  });

  const s = stats.data;
  const displayName =
    (driver.data?.brand_display_name ?? driver.data?.business_name ?? profile?.full_name ?? "")
      .toString()
      .trim() || "Ma vitrine";

  // Conversion : ajouts / visiteurs uniques (fallback : vues), jamais inventée.
  const base = s ? (s.unique_visitors > 0 ? s.unique_visitors : s.views) : 0;
  const conversion =
    s && base > 0 ? `${((s.adds / base) * 100).toFixed(1).replace(".", ",")} %` : "—";

  const sourceRows = s
    ? Object.entries(s.sources)
        .filter(([, n]) => Number(n) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
    : [];
  const sourceTotal = sourceRows.reduce((acc, [, n]) => acc + Number(n), 0);

  const series = s?.series ?? [];
  const maxViews = Math.max(1, ...series.map((p) => Number(p.views)));
  const hasData =
    !!s && (s.views > 0 || s.qr_scans > 0 || s.contact_clicks > 0 || s.adds > 0);

  const trend =
    s && s.adds_previous != null && s.adds_previous > 0
      ? Math.round(((s.adds - s.adds_previous) / s.adds_previous) * 100)
      : null;

  function downloadQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${driver.data?.slug ?? "relink"}.png`;
    a.click();
  }

  async function shareShowcase() {
    if (!url) return;
    const shareUrl = `${url}?src=share`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: displayName,
          text: "Retrouvez ma vitrine ReLink",
          url: shareUrl,
        });
        return;
      } catch {
        /* partage annulé : repli sur la copie */
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Lien de partage copié");
  }

  const themeStyle = driverAccentVars(
    (driver.data as { booking_theme?: string } | null | undefined)?.booking_theme,
  ) as CSSProperties;

  return (
    <div className="min-w-0 max-w-full overflow-hidden" style={themeStyle}>
      <PageHeader
        title="Mon QR Code"
        description="Partagez votre vitrine ReLink et développez votre réseau de clients."
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Carte QR */}
        <div className="surface min-w-0 space-y-4 border border-[color:var(--driver-border,var(--border))] p-4 sm:p-5">
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold">
              <QrCode className="size-4 text-[color:var(--driver-primary,var(--primary))]" />
              Mon QR Code ReLink
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              À scanner pour accéder directement à ma vitrine
            </p>
          </div>

          <div className="flex min-w-0 justify-center">
            <div className="max-w-full rounded-2xl border-2 border-[color:var(--driver-primary,var(--primary))]/30 bg-white p-2 sm:p-3">
              <canvas ref={canvasRef} className="block h-auto max-w-full" />
            </div>
          </div>

          <p className="text-center text-sm font-medium">{displayName} · ReLink</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              onClick={() => void shareShowcase()}
              disabled={!url}
              className="w-full min-w-0 bg-[var(--driver-primary,var(--primary))] text-[color:var(--driver-foreground,var(--primary-foreground))] hover:bg-[var(--driver-primary-hover,var(--primary))]"
            >
              <Share2 className="size-4" /> Partager
            </Button>
            <Button className="w-full min-w-0" variant="outline" onClick={downloadQr} disabled={!qrUrl}>
              <Download className="size-4" /> Télécharger
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-[var(--driver-background-soft,var(--muted))] px-3 py-2">
            <Link2 className="size-4 shrink-0 text-[color:var(--driver-primary,var(--primary))]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Mon lien ReLink</p>
              <p className="truncate text-xs text-muted-foreground">
                {url ? url.replace(/^https?:\/\//, "") : "—"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!url}
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Lien copié");
              }}
            >
              <Copy className="size-4" />
              <span className="sr-only">Copier le lien</span>
            </Button>
          </div>

          {driver.data && !driver.data.page_published ? (
            <div className="space-y-2 rounded-lg bg-warning/10 p-3 text-center text-sm text-muted-foreground">
              <p>
                Votre vitrine n'est actuellement pas accessible sur ReLink : le QR code et votre
                lien ne mènent à aucune page. Contactez le support ReLink pour en savoir plus.
              </p>
            </div>
          ) : null}
        </div>

        {/* Analytics */}
        <div className="min-w-0 space-y-4">
          <div className="surface min-w-0 border border-[color:var(--driver-border,var(--border))] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Ma visibilité</h2>
              <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-auto sm:grid-cols-4">
                {PERIODS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setDays(p.days)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium transition",
                      days === p.days
                        ? "bg-[var(--driver-primary,var(--primary))] text-[color:var(--driver-foreground,var(--primary-foreground))]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {!hasData && !stats.isLoading ? (
              <div className="mt-3 rounded-xl bg-[var(--driver-background-soft,var(--muted))] p-4 text-center">
                <p className="text-sm font-medium">Votre visibilité commence ici</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Partagez votre QR Code ou votre lien pour obtenir vos premières visites.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-[var(--driver-primary,var(--primary))] text-[color:var(--driver-foreground,var(--primary-foreground))] hover:bg-[var(--driver-primary-hover,var(--primary))]"
                  onClick={() => void shareShowcase()}
                  disabled={!url}
                >
                  <Share2 className="size-4" /> Partager ma vitrine
                </Button>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <StatTile value={String(s?.views ?? 0)} label="Ouvertures du profil" />
              <StatTile value={String(s?.qr_scans ?? 0)} label="Flashs du QR code" />
              <StatTile value={String(s?.contact_clicks ?? 0)} label="Clics de contact" />
              <StatTile value={String(s?.adds ?? 0)} label="Ajouts au réseau" />
              <StatTile value={conversion} label="Conversion" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Actualisation automatique toutes les 15 secondes · La conversion correspond au
              pourcentage de visiteurs ayant ajouté votre profil à leurs chauffeurs.
            </p>
          </div>

          <div className="surface min-w-0 border border-[color:var(--driver-border,var(--border))] p-4">
            <h2 className="text-base font-semibold">Visites de ma vitrine</h2>
            <div className="mt-3 flex h-24 items-end gap-[2px]">
              {series.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune visite sur la période.</p>
              ) : (
                series.map((p) => (
                  <div
                    key={p.day}
                    title={`${p.day} · ${p.views} vue(s)`}
                    className="flex-1 rounded-t-sm bg-[var(--driver-primary,var(--primary))]"
                    style={{
                      height: `${Math.max(3, (Number(p.views) / maxViews) * 100)}%`,
                      opacity: Number(p.views) === 0 ? 0.18 : 1,
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <div className="surface min-w-0 border border-[color:var(--driver-border,var(--border))] p-4">
            <h2 className="text-base font-semibold">Comment les visiteurs me trouvent</h2>
            {sourceRows.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Aucune origine enregistrée sur la période.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sourceRows.map(([key, n]) => {
                  const pct = Math.round((Number(n) / sourceTotal) * 100);
                  return (
                    <li key={key}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{SOURCE_LABELS[key] ?? key}</span>
                        <span className="text-muted-foreground">
                          {Number(n)} · {pct} %
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-[var(--driver-primary,var(--primary))]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="surface min-w-0 border border-[color:var(--driver-border,var(--border))] p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="size-4 text-[color:var(--driver-primary,var(--primary))]" />
              Mon réseau
            </h2>
            <p className="mt-2 text-sm">
              <span className="font-semibold text-[color:var(--driver-primary,var(--primary))]">
                +{s?.adds ?? 0}
              </span>{" "}
              nouveaux clients sur la période
              {trend != null ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({trend > 0 ? "+" : ""}
                  {trend} % vs période précédente)
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s?.network_total ?? 0} clients actuellement dans votre réseau.
            </p>
          </div>

          <div className="surface min-w-0 border border-[color:var(--driver-border,var(--border))] p-4">
            <h2 className="text-base font-semibold">Faites connaître votre vitrine</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Partagez votre QR Code ou votre lien ReLink pour permettre à vos clients de vous
              retrouver facilement.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button
                onClick={() => void shareShowcase()}
                disabled={!url}
                className="bg-[var(--driver-primary,var(--primary))] text-[color:var(--driver-foreground,var(--primary-foreground))] hover:bg-[var(--driver-primary-hover,var(--primary))]"
              >
                <Share2 className="size-4" /> Partager ma vitrine
              </Button>
              <Button variant="outline" onClick={downloadQr} disabled={!qrUrl}>
                <Download className="size-4" /> Télécharger le QR
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
