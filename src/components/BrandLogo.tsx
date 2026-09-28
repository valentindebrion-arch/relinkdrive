import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import relinkLogo from "@/assets/relink-logo.png.asset.json";

type Size = "sm" | "md" | "lg";

const LOGO: Record<Size, string> = { sm: "h-7", md: "h-9", lg: "h-12" };
const CONNECT_TEXT: Record<Size, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

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
    <span className={cn("inline-flex items-center gap-0", className)}>
      <img
        src={relinkLogo.url}
        alt="ReLink"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = "/relink-logo.png";
        }}
        className={cn("w-auto shrink-0 object-contain", LOGO[size])}
      />
      <span className={cn("-ml-1.5 font-bold tracking-tight text-[#202522]", CONNECT_TEXT[size])}>
        Connect
      </span>
    </span>
  );

  if (to) {
    return (
      <Link
        to={to}
        aria-label="ReLink Connect — accueil"
        className="tap tap-active inline-flex min-h-11 items-center"
      >
        {content}
      </Link>
    );
  }

  return content;
}
