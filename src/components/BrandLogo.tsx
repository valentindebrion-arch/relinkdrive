import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const MARK: Record<Size, string> = { sm: "size-6", md: "size-7", lg: "size-10" };
const TEXT: Record<Size, string> = { sm: "text-base", md: "text-lg", lg: "text-2xl" };

/** Logo officiel ReLink (marque verte + typographie). */
export function BrandLogo({
  to,
  className,
  size = "md",
}: {
  to?: string;
  className?: string;
  size?: Size;
}) {
  const content = (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      <img
        src="/relink-mark.svg"
        alt="ReLink"
        width={40}
        height={40}
        className={cn(MARK[size], "shrink-0 object-contain")}
      />
      <span className={cn("font-semibold tracking-tight text-primary", TEXT[size])}>
        <span className="text-foreground">Re</span>Link
      </span>
    </span>
  );

  if (to) {
    return (
      <Link
        to={to}
        aria-label="ReLink — accueil"
        className="tap tap-active inline-flex min-h-11 items-center"
      >
        {content}
      </Link>
    );
  }

  return content;
}
