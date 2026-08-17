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
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const q = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Notif[];
    },
  });

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  // Notifications push-up en direct
  useEffect(() => {
    if (!items.length) return;
    if (!primed.current) {
      items.forEach((n) => seen.current.add(n.id));
      primed.current = true;
      return;
    }
    items
      .filter((n) => !seen.current.has(n.id))
      .forEach((n) => {
        seen.current.add(n.id);
        toast(n.title, {
          description: n.body ?? undefined,
          action: n.link
            ? { label: "Voir", onClick: () => navigate({ to: n.link! }) }
            : undefined,
        });
      });
  }, [items, navigate]);

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

  if (!user) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Notifications"
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

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-50 mx-auto w-auto max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-1.5rem)]">
            <p className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</p>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain sm:max-h-96">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Aucune notification pour le moment.</p>
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
                      <p className="mt-0.5 line-clamp-2 text-xs break-words text-muted-foreground">{n.body}</p>
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
      ) : null}
    </div>
  );
}
