/**
 * Bottom sheet affiché lorsqu'un chauffeur en version gratuite touche une
 * option tarifaire réservée à ReLink Pro. Aucun réglage n'est modifié :
 * on explique la valeur de l'offre supérieure puis on laisse le choix.
 */
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function ProFeatureSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border pb-8">
        <SheetHeader className="text-left">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="size-5" />
          </span>
          <SheetTitle className="text-[19px] font-extrabold tracking-tight">
            Débloquez votre tarification complète
          </SheetTitle>
          <SheetDescription className="text-[13.5px]">
            Personnalisez précisément vos tarifs et laissez ReLink calculer automatiquement vos
            estimations de course.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 grid gap-2">
          <Button asChild size="lg" className="min-h-12 w-full font-bold">
            <Link to="/pro/parametres">Découvrir ReLink Pro</Link>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="min-h-12 w-full"
            onClick={() => onOpenChange(false)}
          >
            Plus tard
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Encadre un bloc Pro : lisible, mais non modifiable en version gratuite. */
export function LockedBlock({
  locked,
  onLockedClick,
  children,
}: {
  locked: boolean;
  onLockedClick: () => void;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled
      className="relative cursor-pointer rounded-3xl"
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onLockedClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLockedClick();
        }
      }}
    >
      <div className="pointer-events-none select-none opacity-80">{children}</div>
    </div>
  );
}

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-primary">
      <Lock className="size-3" /> Pro
    </span>
  );
}
