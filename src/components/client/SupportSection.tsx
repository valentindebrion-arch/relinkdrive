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

export function SupportSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

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
        type: "client_issue",
        priority: "normal",
        description: text.slice(0, 2000),
      });
      if (error) throw error;
      setDescription("");
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
      <h2 className="text-base font-semibold">Aide et support technique</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Pour toute question sur une course (horaire, lieu, tarif, annulation), contactez directement
        votre chauffeur. Le support Relink traite uniquement le fonctionnement de l'application.
      </p>

      <ul className="mt-3 divide-y divide-border text-sm">
        <li>
          <Link to="/aide" className="flex min-h-12 items-center justify-between gap-3 font-medium">
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
              <Mail className="size-4 text-primary" /> Contacter le support technique
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
              <Flag className="size-4 text-primary" /> Signaler un problème technique
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </li>
      </ul>

      {open ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-border p-3">
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
