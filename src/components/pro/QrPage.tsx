import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { getMyPublicLink } from "@/lib/driver-qr.functions";
import { PageHeader, StatCard } from "@/components/Ui";
import { Button } from "@/components/ui/button";

export function QrPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [publishing, setPublishing] = useState(false);
  const fetchLink = useServerFn(getMyPublicLink);

  // Le lien public est délivré par le serveur uniquement si le compte est validé.
  const link = useQuery({
    queryKey: ["my-public-link", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchLink(),
  });

  const url = link.data?.available ? link.data.url : "";

  useEffect(() => {
    if (url && canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, url, { width: 260, margin: 1 });
    }
  }, [url]);

  const stats = useQuery({
    queryKey: ["qr-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("analytics_events")
        .select("event")
        .eq("driver_id", user!.id);
      return {
        views: (data ?? []).filter((e) => e.event === "driver_page_view").length,
        added: (data ?? []).filter((e) => e.event === "driver_added").length,
      };
    },
  });

  function downloadQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${driver.data?.slug ?? "relink"}.png`;
    a.click();
  }


  return (
    <>
      <PageHeader
        title="Mon QR code"
        description="À montrer en fin de course pour fidéliser vos clients."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface flex flex-col items-center gap-4 p-6 lg:col-span-2">
          <>
            <canvas ref={canvasRef} className="rounded-lg bg-white p-3" />
              <p className="text-center text-sm break-all text-muted-foreground">{url}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!url}
                  onClick={() => {
                    void navigator.clipboard.writeText(url);
                    toast.success("Lien copié");
                  }}
                >
                  <Copy className="size-4" /> Copier le lien
                </Button>
                <Button onClick={downloadQr} disabled={!url}>
                  <Download className="size-4" /> Télécharger
                </Button>
              </div>
              {!driver.data?.page_published ? (
                <div className="space-y-2 rounded-lg bg-warning/10 p-3 text-center text-sm text-muted-foreground">
                  <p>Votre page publique est actuellement dépubliée : le QR code ne mène à rien.</p>
                  <Button
                    size="sm"
                    disabled={publishing}
                    onClick={async () => {
                      setPublishing(true);
                      const { error } = await supabase
                        .from("driver_profiles")
                        .update({ page_published: true })
                        .eq("user_id", user!.id);
                      setPublishing(false);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Page publiée");
                        void driver.refetch();
                        void link.refetch();
                      }
                    }}
                  >
                    Publier ma page
                  </Button>
                </div>
              ) : null}
          </>
        </div>
        <div className="space-y-4">
          <StatCard label="Vues de la page" value={stats.data?.views ?? 0} />
          <StatCard label="Clients ajoutés" value={stats.data?.added ?? 0} />
          <StatCard
            label="Taux de conversion"
            value={
              stats.data?.views
                ? `${Math.round(((stats.data.added ?? 0) / stats.data.views) * 100)}%`
                : "—"
            }
          />
        </div>
      </div>
    </>
  );
}
