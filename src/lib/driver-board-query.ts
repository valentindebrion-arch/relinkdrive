import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getDriverBoard } from "@/lib/driver-board.functions";
import type { DriverBoard } from "@/lib/driver-board";

export const DRIVER_BOARD_KEY = "driver-board";

const NOTIFIED_KEY = "relink.imminent-notified";

function alreadyNotified(rideId: string) {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (list.includes(rideId)) return true;
    window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...list.slice(-20), rideId]));
    return false;
  } catch {
    return true;
  }
}

/**
 * Classement officiel des courses du chauffeur (source serveur unique).
 * Recalculé périodiquement, au retour au premier plan et après reconnexion,
 * afin que la bascule T - 1 h fonctionne sans rechargement manuel.
 */
export function useDriverBoard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getDriverBoard);
  const lastImminent = useRef<string | null>(null);

  const query = useQuery<DriverBoard>({
    queryKey: [DRIVER_BOARD_KEY, user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => fetchBoard({}),
  });

  // Synchronisation temps réel (acceptation, démarrage, annulation admin…).
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`driver-board-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        void qc.invalidateQueries({ queryKey: [DRIVER_BOARD_KEY] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, () => {
        void qc.invalidateQueries({ queryKey: [DRIVER_BOARD_KEY] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  // Notification au passage du seuil T - 1 h.
  const board = query.data;
  useEffect(() => {
    if (!board?.activeRide || board.activeReason !== "imminent") {
      lastImminent.current = null;
      return;
    }
    const id = board.activeRide.id;
    if (lastImminent.current === id) return;
    lastImminent.current = id;
    if (alreadyNotified(id)) return;
    const message = "Votre course programmée débute dans une heure.";
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("ReLink", { body: message });
      }
    } catch {
      /* notifications indisponibles */
    }
  }, [board?.activeRide, board?.activeReason]);

  return query;
}

export function invalidateDriverBoard(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [DRIVER_BOARD_KEY] });
}
