import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import relinkLogo from "@/assets/relink-logo.png.asset.json";

type Size = "sm" | "md" | "lg";

const LOGO: Record<Size, string> = { sm: "h-7", md: "h-9", lg: "h-12" };

/** Logo officiel ReLink (fichier image de référence). */
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
    <img
      src={relinkLogo.url}
      alt="ReLink"
      className={cn("w-auto shrink-0 object-contain", LOGO[size], className)}
    />
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
