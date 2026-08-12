import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, LogOut, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { requestAccountDeletion } from "@/lib/account.functions";

export function AccountSection() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "export" | "signout" | "delete">(null);
  const [confirmText, setConfirmText] = useState("");

  async function exportData() {
    if (!user?.id) return;
    setBusy("export");
    try {
      const [rides, requests, invoices, addresses, connections] = await Promise.all([
        supabase.from("rides").select("*").eq("client_id", user.id),
        supabase.from("ride_requests").select("*").eq("client_id", user.id),
        supabase.from("invoices").select("*").eq("client_id", user.id),
        supabase.from("client_addresses").select("*").eq("client_id", user.id),
        supabase.from("driver_client_connections").select("*").eq("client_id", user.id),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        profile,
        rides: rides.data ?? [],
        ride_requests: requests.data ?? [],
        invoices: invoices.data ?? [],
        addresses: addresses.data ?? [],
        drivers: connections.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relink-mes-donnees.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Vos données ont été téléchargées.");
    } catch {
      toast.error("Export impossible pour le moment.");
    } finally {
      setBusy(null);
    }
  }

  async function doSignOut() {
    setBusy("signout");
    try {
      await signOut();
      const { data } = await supabase.auth.getSession();
      if (data.session) throw new Error("session");
      navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("La déconnexion a échoué. Vérifiez votre connexion puis réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    setBusy("delete");
    try {
      await requestAccountDeletion({ data: { confirmation: "SUPPRIMER" } });
      await signOut();
      toast.success("Votre compte a été désactivé et sera supprimé.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">Gestion du compte</h2>

      <Button
        variant="outline"
        className="mt-3 min-h-11 w-full justify-start"
        onClick={() => void exportData()}
        disabled={busy === "export"}
      >
        <Download className="size-4" /> Télécharger mes données
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="mt-2 min-h-11 w-full justify-start">
            <LogOut className="size-4" /> Se déconnecter
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous devrez vous reconnecter pour accéder à vos courses. Vos données sont conservées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doSignOut()} disabled={busy === "signout"}>
              Se déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-destructive">Zone sensible</p>
        <p className="mt-1 text-xs text-muted-foreground">
          La suppression désactive immédiatement votre compte et votre accès à Relink. Vos factures
          sont conservées le temps requis par la loi, puis supprimées.
        </p>
        <AlertDialog onOpenChange={() => setConfirmText("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-3 min-h-11 w-full">
              <Trash2 className="size-4" /> Supprimer mon compte
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement mon compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible : vous perdrez l'accès à vos courses, vos chauffeurs
                et vos factures. Saisissez SUPPRIMER pour confirmer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div>
              <Label htmlFor="del-confirm">Confirmation</Label>
              <Input
                id="del-confirm"
                value={confirmText}
                placeholder="SUPPRIMER"
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={confirmText.trim() !== "SUPPRIMER" || busy === "delete"}
                onClick={(e) => {
                  if (confirmText.trim() !== "SUPPRIMER") {
                    e.preventDefault();
                    return;
                  }
                  void doDelete();
                }}
              >
                Supprimer mon compte
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
