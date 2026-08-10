import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Share, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";

const LABELS: Record<PushState, string> = {
  enabled: "Notifications activées",
  disabled: "Notifications désactivées",
  prompt: "Notifications désactivées",
  denied: "Autorisation refusée sur ce téléphone",
  "ios-needs-install": "Installez Relink sur votre écran d'accueil pour activer les notifications",
  unsupported: "Notifications non prises en charge sur cet appareil",
};

export function PushSettingsCard({ audience = "client" }: { audience?: "client" | "driver" }) {
  const { user } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    setState(await getPushState(user?.id));
  }, [user?.id]);

  useEffect(() => {
    void sync();
  }, [sync]);

  async function toggle(next: boolean) {
    if (!user?.id) return;
    setBusy(true);
    try {
      if (next) {
        await enablePush(user.id);
        toast.success("Notifications activées sur cet appareil");
      } else {
        await disablePush(user.id);
        toast.success("Notifications désactivées sur cet appareil");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation impossible");
    } finally {
      await sync();
      setBusy(false);
    }
  }

  const canToggle = state === "enabled" || state === "disabled" || state === "prompt";
  const enabled = state === "enabled";

  return (
    <div className="surface grid gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          {enabled ? (
            <Bell className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : (
            <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {audience === "driver"
                ? "Activez les notifications pour être informé des nouvelles demandes et des événements de vos courses, même lorsque Relink est fermée."
                : "Activez les notifications pour être informé des réponses du chauffeur et des changements concernant vos courses, même lorsque Relink est fermée."}
            </p>
            <p
              className={`mt-2 text-xs font-medium ${
                enabled ? "text-primary" : state === "denied" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {state ? LABELS[state] : "Vérification en cours…"}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={!canToggle || busy || !user}
          onCheckedChange={(v) => void toggle(v)}
          aria-label="Activer les notifications"
        />
      </div>

      {state === "prompt" || state === "disabled" ? (
        <Button size="sm" className="w-fit" disabled={busy} onClick={() => void toggle(true)}>
          Activer les notifications
        </Button>
      ) : null}

      {state === "denied" ? (
        <div className="flex gap-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Les notifications ont été refusées pour Relink. Réactivez-les dans les réglages de votre
            téléphone (Notifications → Relink), puis revenez sur cette page. Pensez également à vérifier
            un éventuel mode Concentration.
          </p>
        </div>
      ) : null}

      {state === "ios-needs-install" ? (
        <div className="flex gap-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          <Share className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">
              Pour recevoir les notifications lorsque Relink est fermée :
            </p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>ouvrez le menu Partager de Safari ;</li>
              <li>choisissez « Sur l'écran d'accueil » ;</li>
              <li>ouvrez ensuite Relink depuis son icône ;</li>
              <li>activez les notifications.</li>
            </ol>
          </div>
        </div>
      ) : null}

      {state === "unsupported" ? (
        <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          Ce navigateur ne permet pas les notifications en arrière-plan. Vous continuerez à recevoir les
          alertes dans l'application lorsqu'elle est ouverte.
        </p>
      ) : null}
    </div>
  );
}
