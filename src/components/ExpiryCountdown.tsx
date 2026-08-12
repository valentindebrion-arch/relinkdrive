import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Compte à rebours de réponse du chauffeur (10 minutes).
 * L'échéance vient toujours du serveur (`response_deadline`) : l'affichage n'est
 * qu'une projection locale, jamais la source de vérité de l'expiration.
 */
export function useCountdown(deadlineIso?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineIso]);

  if (!deadlineIso) return null;
  const end = new Date(deadlineIso).getTime();
  if (Number.isNaN(end)) return null;
  const msLeft = Math.max(0, end - now);
  return {
    msLeft,
    secondsLeft: Math.ceil(msLeft / 1000),
    expired: msLeft <= 0,
    label: formatMs(msLeft),
  };
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Appelle `onExpire` une seule fois lorsque l'échéance serveur est atteinte. */
export function useExpiryEffect(deadlineIso: string | null | undefined, expired: boolean, onExpire: () => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (!deadlineIso) return;
    if (!expired || fired.current) return;
    fired.current = true;
    onExpire();
  }, [deadlineIso, expired, onExpire]);
  useEffect(() => {
    fired.current = false;
  }, [deadlineIso]);
}

const TOTAL_MS = 10 * 60 * 1000;

export function ExpiryRing({
  msLeft,
  label,
  size = 96,
  children,
}: {
  msLeft: number;
  label: string;
  size?: number;
  children?: React.ReactNode;
}) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(1, Math.max(0, msLeft / TOTAL_MS));
  const urgent = msLeft <= 60_000;

  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={4} className="fill-none stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn(
            "fill-none transition-[stroke-dashoffset] duration-1000 ease-linear",
            urgent ? "stroke-destructive" : "stroke-primary",
          )}
        />
      </svg>
      <span className="absolute grid place-items-center">
        {children ?? (
          <span
            className={cn(
              "text-base font-extrabold tabular-nums",
              urgent ? "text-destructive" : "text-primary",
            )}
            aria-live="polite"
          >
            {label}
          </span>
        )}
      </span>
    </span>
  );
}
