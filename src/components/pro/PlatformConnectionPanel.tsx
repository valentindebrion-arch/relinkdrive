/**
 * Configuration « Facturation → Facturation électronique » : choix de la
 * plateforme agréée, environnement, options activées, tests et historique.
 * Aucune clé ni jeton n'est affiché : seule une référence opaque est saisie.
 */
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/labels";
import { PROVIDERS, getProvider, type ProviderEnvironment } from "@/lib/einvoicing/provider";
import {
  CONNECTION_STATUS_LABELS,
  useConnectionMutations,
  type EInvoicingConnection,
} from "@/lib/einvoicing/connections";

export function PlatformConnectionPanel({
  driverId,
  connection,
}: {
  driverId: string;
  connection: EInvoicingConnection | null;
}) {
  const { connect, test, sync, disconnect, update } = useConnectionMutations(driverId);
  const [providerKey, setProviderKey] = useState(connection?.provider_key ?? PROVIDERS[0]!.key);
  const [environment, setEnvironment] = useState<ProviderEnvironment>(connection?.environment ?? "sandbox");
  const [account, setAccount] = useState(connection?.external_account_id ?? "");
  const [address, setAddress] = useState(connection?.electronic_billing_address ?? "");
  const [reference, setReference] = useState("");

  const provider = getProvider(providerKey);
  const connected = connection?.connection_status === "connected";

  async function handleConnect() {
    try {
      const res = await connect.mutateAsync({
        providerKey,
        environment,
        externalAccountId: account || null,
        electronicBillingAddress: address || null,
        credentialsReference: reference || null,
      });
      setReference("");
      toast.success(res.message ?? "Plateforme enregistrée");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Ma plateforme agréée</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ReLink n'est pas une plateforme agréée. Vos factures transitent par la plateforme que vous choisissez.
          </p>
        </div>
        {connection?.environment === "sandbox" ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
            Environnement de test
          </span>
        ) : null}
      </div>

      {connection ? (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Plateforme" value={getProvider(connection.provider_key).label} />
          <Info label="Statut" value={CONNECTION_STATUS_LABELS[connection.connection_status]} />
          <Info label="Environnement" value={connection.environment === "sandbox" ? "Test" : "Production"} />
          <Info label="Adresse électronique de facturation" value={connection.electronic_billing_address ?? "—"} />
          <Info
            label="Dernière vérification"
            value={connection.last_verified_at ? formatDate(connection.last_verified_at) : "Jamais"}
          />
          <Info label="Dernière synchronisation" value={connection.last_sync_at ? formatDate(connection.last_sync_at) : "—"} />
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Connexion à une plateforme agréée nécessaire pour transmettre vos factures.
        </p>
      )}

      {connection ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["reception_enabled", "Réception activée"],
              ["emission_enabled", "Émission activée"],
              ["transaction_reporting_enabled", "E-reporting des transactions"],
              ["payment_reporting_enabled", "E-reporting des encaissements"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <span>{label}</span>
              <Switch
                checked={connection[key]}
                onCheckedChange={(v) => update.mutate({ id: connection.id, values: { [key]: v } as never })}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div>
          <Label>Choisir une plateforme agréée</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setProviderKey(p.key)}
                className={`tap-active rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  providerKey === p.key ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Environnement</Label>
            <div className="mt-1 flex gap-1">
              {(["sandbox", "production"] as ProviderEnvironment[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={e === "production" && provider.simulation}
                  onClick={() => setEnvironment(e)}
                  className={`tap-active rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    environment === e ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {e === "sandbox" ? "Test" : "Production"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="pa-account">Identifiant de compte chez la plateforme</Label>
            <Input id="pa-account" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="ex. ACC-12345" />
          </div>
          <div>
            <Label htmlFor="pa-address">Mon adresse électronique de facturation</Label>
            <Input id="pa-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="SIREN ou identifiant de routage" />
          </div>
          <div>
            <Label htmlFor="pa-ref">Référence du secret d'API</Label>
            <Input
              id="pa-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Référence du coffre (jamais la clé)"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ne saisissez jamais une clé ou un jeton ici : seule sa référence est conservée.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void handleConnect()} disabled={connect.isPending}>
            <PlugZap className="mr-1 size-4" /> {connection ? "Mettre à jour la connexion" : "Connecter"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!connection || test.isPending}
            onClick={async () => {
              const res = await test.mutateAsync(connection!);
              res.ok ? toast.success(res.message) : toast.error(res.message);
            }}
          >
            <CheckCircle2 className="mr-1 size-4" /> Tester la connexion
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!connection}
            onClick={async () => {
              await sync.mutateAsync(connection!);
              toast.success("Synchronisation enregistrée");
            }}
          >
            <RefreshCw className="mr-1 size-4" /> Synchroniser
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!connection}
            onClick={async () => {
              await disconnect.mutateAsync(connection!);
              toast.success("Plateforme déconnectée");
            }}
          >
            <Unplug className="mr-1 size-4" /> Déconnecter
          </Button>
        </div>

        {connection?.last_error_message ? (
          <p className="text-xs text-destructive">{connection.last_error_message}</p>
        ) : null}
        {connected && getProvider(connection!.provider_key).simulation ? (
          <p className="text-xs text-warning">
            Connecteur de test : les transmissions sont simulées et n'ont aucune valeur réglementaire.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
