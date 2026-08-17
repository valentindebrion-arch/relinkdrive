import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Calque global de notifications.
 * Monté par portail directement sous `document.body` : aucune carte, aucun
 * carrousel, aucun conteneur animé (transform/overflow hidden) ne peut le
 * rogner ni le masquer. Le z-index suit l'échelle globale (cf. styles.css).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <Sonner
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      duration={5000}
      gap={10}
      // Sous la safe area, avec une marge latérale : jamais de débordement.
      offset={{ top: "calc(env(safe-area-inset-top) + 12px)", left: "12px", right: "12px" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)", left: "12px", right: "12px" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:w-full group-[.toaster]:max-w-full group-[.toaster]:min-w-0 group-[.toaster]:[overflow-wrap:anywhere]",
          title: "group-[.toast]:min-w-0 group-[.toast]:[overflow-wrap:anywhere]",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:min-w-0 group-[.toast]:[overflow-wrap:anywhere]",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />,
    document.body,
  );
};

export { Toaster };
