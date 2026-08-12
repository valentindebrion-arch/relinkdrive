import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HelpCircle, Mail, Flag, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RideOption = { id: string; label: string };

export function SupportSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rides, setRides] = useState<RideOption[]>([]);
  const [rideId, setRideId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || !open) return;
    void supabase
      .from("rides")
      .select("id, pickup_address, dropoff_address, scheduled_at")
      .eq("client_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setRides(
          (data ?? []).map((r) => ({
            id: r.id,
            label: `${new Date(r.scheduled_at).toLocaleDateString("fr-FR")} — ${r.pickup_address} → ${r.dropoff_address}`,
          })),
        );
      });
  }, [user?.id, open]);

  async function submit() {
    const text = description.trim();
    if (text.length < 10) {
      toast.error("Décrivez le problème en quelques mots (10 caractères minimum).");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: user!.id,
        ride_id: rideId === "none" ? null : rideId,
        type: "client_issue",
        priority: "normal",
        description: text.slice(0, 2000),
      });
      if (error) throw error;
      setDescription("");
      setRideId("none");
      setOpen(false);
      toast.success("Signalement envoyé. Notre équipe vous répondra par e-mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">Aide et assistance</h2>

      <ul className="mt-3 divide-y divide-border text-sm">
        <li>
          <Link
            to="/aide"
            className="flex min-h-12 items-center justify-between gap-3 font-medium"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" /> Centre d'aide et questions fréquentes
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
        <li>
          <a
            href="mailto:support@relink.app"
            className="flex min-h-12 items-center justify-between gap-3 font-medium"
          >
            <span className="flex items-center gap-2">
              <Mail className="size-4 text-primary" /> Nous contacter
            </span>
            <span className="text-xs text-muted-foreground">support@relink.app</span>
          </a>
        </li>
        <li>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-12 w-full items-center justify-between gap-3 font-medium"
          >
            <span className="flex items-center gap-2">
              <Flag className="size-4 text-primary" /> Signaler un problème
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </li>
      </ul>

      {open ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-border p-3">
          <div>
            <Label htmlFor="rep-ride">Course concernée (facultatif)</Label>
            <Select value={rideId} onValueChange={setRideId}>
              <SelectTrigger id="rep-ride" className="mt-1">
                <SelectValue placeholder="Aucune course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune course</SelectItem>
                {rides.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rep-desc">Description</Label>
            <Textarea
              id="rep-desc"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le problème rencontré."
            />
          </div>
          <Button className="min-h-11" onClick={() => void submit()} disabled={busy}>
            {busy ? "Envoi…" : "Envoyer le signalement"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
