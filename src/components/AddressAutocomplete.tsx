import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { suggestAddresses } from "@/lib/route-estimate.functions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Suggestion = { full: string; main: string; secondary: string };

export function AddressAutocomplete({
  value,
  confirmed,
  placeholder,
  ariaLabel,
  label,
  icon,
  action,
  bare,
  onChange,
  onConfirm,
}: {
  value: string;
  confirmed: boolean;
  placeholder: string;
  ariaLabel: string;
  label?: string;
  icon: ReactNode;
  action?: ReactNode;
  bare?: boolean;
  onChange: (v: string) => void;
  onConfirm: (v: string) => void;
}) {
  const suggestFn = useServerFn(suggestAddresses);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmed || value.trim().length < 3) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await suggestFn({ data: { query: value.trim() } });
        if (!cancelled) {
          setItems(res.items);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setLoading(false);
    };
  }, [value, confirmed, suggestFn]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cn(
          "flex items-center gap-3 transition-all duration-200",
          bare
            ? "px-1"
            : cn(
                "rounded-2xl border bg-card px-3",
                confirmed ? "border-primary/50 ring-2 ring-primary/15" : "border-input",
              ),
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <div className="min-w-0 flex-1">
          {label ? <p className="text-[13px] font-semibold">{label}</p> : null}
          <Input
            aria-label={ariaLabel}
            className={cn(
              "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
              bare ? "h-7 text-[15px] placeholder:text-muted-foreground" : "h-12 text-base",
            )}
            placeholder={placeholder}
            maxLength={160}
            value={value}
            onFocus={() => items.length && setOpen(true)}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {confirmed ? (
          <span className="animate-scale-in flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        ) : loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        {action}
      </div>

      {open && !confirmed && items.length > 0 ? (
        <ul className="animate-fade-in absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-pop)]">
          {items.map((s) => (
            <li key={s.full}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left transition-colors hover:bg-accent"
                onClick={() => {
                  onConfirm(s.full);
                  setOpen(false);
                  setItems([]);
                }}
              >
                <p className="text-sm font-medium">{s.main || s.full}</p>
                {s.secondary ? (
                  <p className="text-xs text-muted-foreground">{s.secondary}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
