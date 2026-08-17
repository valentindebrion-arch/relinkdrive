export type InfoItem = { label: string; value: string };

/** Grille compacte d'informations de réservation (une colonne sur petit écran). */
export function TrackingInfoCard({
  title = "Informations de réservation",
  items,
  footer,
}: {
  title?: string;
  items: InfoItem[];
  footer?: React.ReactNode;
}) {
  if (!items.length && !footer) return null;
  return (
    <section className="motion-safe:animate-fade-in rounded-3xl border border-border bg-card p-[clamp(1rem,4vw,1.35rem)]">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0"
          >
            <dt className="min-w-0 shrink text-sm text-muted-foreground">{item.label}</dt>
            <dd className="min-w-0 max-w-[62%] text-right text-sm font-medium [overflow-wrap:anywhere]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer}
    </section>
  );
}
