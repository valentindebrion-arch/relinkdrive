import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandLogo({ to, className }: { to?: string; className?: string }) {
  const content = (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span className="rounded-lg bg-primary px-1.5 py-0.5 text-lg font-semibold tracking-tight text-primary-foreground">
        Re
      </span>
      <span className="text-lg font-semibold tracking-tight text-primary">Link</span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center tap tap-active">
        {content}
      </Link>
    );
  }

  return content;
}
