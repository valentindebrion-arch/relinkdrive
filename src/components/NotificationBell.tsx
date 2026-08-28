import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";


type Notif = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ring, setRing] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setMounted(true), []);

  const q = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });


  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  // Arrivée d'une notification : aucune popup, uniquement l'animation de la
  // cloche et la mise à jour du badge.
  useEffect(() => {
    if (!items.length) return;
    if (!primed.current) {
      items.forEach((n) => seen.current.add(n.id));
      primed.current = true;
      return;
    }
    const fresh = items.filter((n) => !seen.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(n.id));
    setRing(true);
    const timer = window.setTimeout(() => setRing(false), 800);
    return () => window.clearTimeout(timer);
  }, [items]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  async function markAllRead() {
    if (!user?.id || unread === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    void qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }

  // Fermeture : Escape, changement de route ; verrouillage du défilement de fond
  // et restauration du focus sur la cloche.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = previous;
      bellRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!user) return null;

  const panel = (
    <>
      <div
        className="notif-overlay"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        tabIndex={-1}
        className="notif-panel right-0 bottom-0 left-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl outline-none sm:top-[max(1rem,env(safe-area-inset-top))] sm:bottom-auto sm:left-auto sm:m-4 sm:max-h-[min(32rem,85dvh)] sm:w-80 sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button
            type="button"
            aria-label="Fermer les notifications"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {q.isPending ? (
            <div className="space-y-2 px-4 py-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : q.isError ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              <p>Impossible de récupérer vos notifications.</p>
              <button
                type="button"
                onClick={() => void q.refetch()}
                className="mt-2 text-sm font-bold text-primary"
              >
                Réessayer
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Vous n'avez aucune notification pour le moment.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (n.link) navigate({ to: n.link });
                }}
                className="block w-full border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted"
              >
                <p className="truncate text-sm font-medium">{n.title}</p>
                {n.body ? (
                  <p className="mt-0.5 line-clamp-2 text-xs break-words text-muted-foreground">
                    {n.body}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("fr-FR")}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={bellRef}
        type="button"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void markAllRead();
        }}
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span key={unread} className="badge-pop absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && mounted ? createPortal(panel, document.body) : null}
    </div>

  );
}
