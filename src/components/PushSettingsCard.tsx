import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Share, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";

type PrefKey = "request" | "ride" | "connection" | "invoice" | "info";
type Prefs = Record<PrefKey, boolean>;

const DEFAULT_PREFS: Prefs = {
  request: true,
  ride: true,
  connection: true,
  invoice: true,
  info: false,
};

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
                enabled
                  ? "text-primary"
                  : state === "denied"
                    ? "text-destructive"
                    : "text-muted-foreground"
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
            téléphone (Notifications → Relink), puis revenez sur cette page. Pensez également à
            vérifier un éventuel mode Concentration.
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
          Ce navigateur ne permet pas les notifications en arrière-plan. Vous continuerez à recevoir
          les alertes dans l'application lorsqu'elle est ouverte.
        </p>
      ) : null}

      <NotificationPrefs audience={audience} />
    </div>
  );
}

const PREF_ITEMS: { key: PrefKey; label: string; hint: string; critical: boolean }[] = [
  {
    key: "request",
    label: "Nouvelles demandes de course",
    hint: "Alerte immédiate à chaque demande.",
    critical: true,
  },
  {
    key: "ride",
    label: "Modifications et annulations",
    hint: "Changements sur vos courses.",
    critical: true,
  },
  {
    key: "connection",
    label: "Nouveaux contacts",
    hint: "Ajout d'un chauffeur ou d'un client.",
    critical: false,
  },
  { key: "invoice", label: "Facturation", hint: "Factures et encaissements.", critical: false },
  {
    key: "info",
    label: "Informations Relink",
    hint: "Nouveautés et conseils (facultatif).",
    critical: false,
  },
];

function NotificationPrefs({ audience }: { audience: "client" | "driver" }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notification_prefs")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      const raw = (data as { notification_prefs?: Prefs } | null)?.notification_prefs;
      setPrefs({ ...DEFAULT_PREFS, ...(raw ?? {}) });
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function update(key: PrefKey, value: boolean) {
    if (!user?.id || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: next } as never)
      .eq("id", user.id);
    if (error) {
      setPrefs(prefs);
      toast.error("Réglage non enregistré");
    }
  }

  if (!user) return null;

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-semibold">Ce que vous recevez</p>
        <p className="text-xs text-muted-foreground">
          {audience === "driver"
            ? "Choisissez les alertes envoyées sur votre téléphone. Tout reste consultable dans l'onglet Notifications."
            : "Choisissez les alertes envoyées sur votre téléphone. Tout reste consultable dans vos notifications."}
        </p>
      </div>
      {PREF_ITEMS.map((item) => (
        <div key={item.key} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {item.label}
              {item.critical ? (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Essentiel
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">{item.hint}</p>
          </div>
          <Switch
            checked={prefs ? prefs[item.key] : false}
            disabled={!prefs}
            onCheckedChange={(v) => void update(item.key, v)}
            aria-label={item.label}
          />
        </div>
      ))}
    </div>
  );
}
