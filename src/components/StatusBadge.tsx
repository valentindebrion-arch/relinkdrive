import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/labels";

const tones: Record<string, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/35",
  danger: "bg-destructive/12 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  status,
  labels,
  className,
}: {
  status: string;
  labels?: Record<string, string>;
  className?: string;
}) {
  const tone = tones[statusTone(status)] ?? tones["neutral"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      {labels?.[status] ?? status}
    </span>
  );
}
