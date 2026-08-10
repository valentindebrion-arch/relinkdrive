import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRideClientSmsTarget, logSmsIntent } from "@/lib/ride-sms.functions";
import { buildSmsHref, buildSmsMessage, isMobileDevice, rideClientUrl } from "@/lib/ride-sms";

/** Boîte de dialogue : proposer d'informer le client par SMS (envoi manuel par le chauffeur). */
export function NotifyClientSmsDialog({
  rideId,
  open,
  onOpenChange,
  title = "Votre départ a été enregistré. Souhaitez-vous informer le client par SMS ?",
}: {
  rideId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
}) {
  const fetchTarget = useServerFn(getRideClientSmsTarget);
  const logIntent = useServerFn(logSmsIntent);
  const [opening, setOpening] = useState(false);
  const [mobile, setMobile] = useState(true);
  const [origin, setOrigin] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMobile(isMobileDevice());
    setOrigin(window.location.origin);
  }, []);

  const target = useQuery({
    queryKey: ["ride-sms-target", rideId],
    enabled: open,
    staleTime: 60_000,
    queryFn: () => fetchTarget({ data: { rideId } }),
  });

  const link = rideClientUrl(rideId, origin);
  const message = target.data?.scheduledAt
    ? buildSmsMessage({
        driverFirstName: target.data.driverFirstName,
        scheduledAt: target.data.scheduledAt,
        link,
      })
    : "";
  const phone = target.data?.phone ?? null;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Copie impossible sur cet appareil");
    }
  }

  async function openMessaging() {
    if (!phone || opening) return;
    setOpening(true);
    try {
      void logIntent({ data: { rideId } });
      window.location.href = buildSmsHref(phone, message);
      onOpenChange(false);
    } finally {
      setTimeout(() => setOpening(false), 1500);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>
            Le message s'ouvre dans votre application SMS : vérifiez-le puis envoyez-le vous-même.
          </DialogDescription>
        </DialogHeader>

        {target.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : !phone ? (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            Le numéro permettant d'informer ce client n'est pas disponible.
          </p>
        ) : (
          <>
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed break-words">
              {message}
            </p>
            {!mobile ? (
              <p className="text-xs text-muted-foreground">
                Cette action est disponible depuis un téléphone compatible.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(message, "Message copié")}>
                <Copy className="size-4" /> Copier le message
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(link, "Lien copié")}>
                <Link2 className="size-4" /> Copier le lien
              </Button>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button className="gap-2" disabled={!phone || opening} onClick={() => void openMessaging()}>
            <MessageSquare className="size-4" />
            {opening ? "Ouverture…" : "Informer le client par SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bouton persistant pendant la phase « en route » vers le client. */
export function NotifyClientSmsButton({ rideId, className }: { rideId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className={`w-full gap-2 ${className ?? ""}`} onClick={() => setOpen(true)}>
        <MessageSquare className="size-4" />
        Informer le client par SMS
      </Button>
      <NotifyClientSmsDialog
        rideId={rideId}
        open={open}
        onOpenChange={setOpen}
        title="Informer le client par SMS"
      />
    </>
  );
}
