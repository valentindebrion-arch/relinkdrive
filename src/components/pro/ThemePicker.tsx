/**
 * Sélecteur compact « Style de ma vitrine ».
 *
 * Une seule source de vérité : `driver_profiles.booking_theme`.
 * Le style Woman for Woman n'est pas qu'une couleur : le choisir active le mode
 * Woman for Woman (réservé aux chauffeuses ayant déclaré « Femme »).
 */
import { useState } from "react";
import { Check, ChevronRight, Lock, Sparkles } from "lucide-react";
import {
  BOOKING_THEMES,
  DRIVER_THEME_OPTIONS,
  DRIVER_THEME_SHORT_LABEL,
  getBookingTheme,
  type BookingThemeId,
} from "@/lib/booking-themes";
import {
  GENDER_HELP,
  GENDER_LOCK_WARNING,
  GENDER_OPTIONS,
  WFW_DRIVER_DESCRIPTION,
  WFW_DRIVER_PROFILE_REQUIRED,
  driverCanOfferWfw,
} from "@/lib/woman-for-woman";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WFW_THEME: BookingThemeId = "women_for_women";

function ThemeDot({ id }: { id: BookingThemeId }) {
  return (
    <span
      className="size-5 shrink-0 rounded-full border border-border shadow-sm"
      style={{ background: getBookingTheme(id).banner }}
      aria-hidden
    />
  );
}

export function ThemePicker({
  value,
  gender,
  genderLocked,
  onChange,
  onGenderChange,
}: {
  value: BookingThemeId;
  /** Genre déclaré du chauffeur (déclaratif, jamais déduit). */
  gender: string;
  /** Le genre a déjà été enregistré : il est définitif. */
  genderLocked: boolean;
  onChange: (id: BookingThemeId) => void;
  onGenderChange: (gender: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState<BookingThemeId | null>(null);
  const current = getBookingTheme(value);
  const canWfw = driverCanOfferWfw(gender);

  function select(id: BookingThemeId) {
    if (id === value) {
      setOpen(false);
      return;
    }
    if (id === WFW_THEME && !canWfw) return;
    if (value === WFW_THEME) {
      setLeaveOpen(id);
      return;
    }
    onChange(id);
    setOpen(false);
  }

  return (
    <>
      <section className="surface mb-4 flex items-center gap-3 p-3.5">
        <ThemeDot id={current.id} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Style de ma vitrine</p>
          <p className="truncate text-xs text-muted-foreground">
            {DRIVER_THEME_SHORT_LABEL[current.id]} · Thème actuel
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-active flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
        >
          Changer le style <ChevronRight className="size-3.5" />
        </button>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="px-0">
            <SheetTitle>Choisir le style de ma vitrine</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground">
            Le style s'applique partout où votre profil apparaît. L'aperçu est immédiat,
            l'enregistrement le rend définitif.
          </p>
          <div className="mt-3 space-y-2 pb-6">
            {DRIVER_THEME_OPTIONS.map((t) => {
              const active = t.id === value;
              const locked = t.id === WFW_THEME && !canWfw;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(t.id)}
                  disabled={locked}
                  aria-pressed={active}
                  className={`tap-active flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    active ? "border-primary bg-accent/60" : "border-border hover:border-primary/40"
                  } ${locked ? "opacity-60" : ""}`}
                >
                  <ThemeDot id={t.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {DRIVER_THEME_SHORT_LABEL[t.id]}
                      {t.id === WFW_THEME ? <Sparkles className="size-3.5" aria-hidden /> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {locked ? "🔒 Réservé aux profils féminins" : t.mood}
                    </span>
                  </span>
                  {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                  {locked ? <Lock className="size-4 shrink-0 text-muted-foreground" /> : null}
                </button>
              );
            })}
          </div>

          {/* Woman for Woman : mode réservé, éligibilité strictement déclarative. */}
          <div className="mb-6 rounded-2xl border border-border p-3">
            <p className="text-[13px] font-semibold">Woman for Woman</p>
            <p className="mt-1 text-xs text-muted-foreground">{WFW_DRIVER_DESCRIPTION}</p>
            {canWfw ? null : genderLocked ? (
              <p className="mt-2 text-xs text-muted-foreground">{WFW_DRIVER_PROFILE_REQUIRED}</p>
            ) : (
              <div className="mt-2">
                <label htmlFor="showcase-gender" className="text-xs font-medium">
                  Genre / sexe
                </label>
                <select
                  id="showcase-gender"
                  value={gender}
                  onChange={(e) => onGenderChange(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="">Non renseigné</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">{GENDER_HELP}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{GENDER_LOCK_WARNING}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!leaveOpen} onOpenChange={(o) => !o && setLeaveOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter le mode Woman for Woman ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre profil ne sera plus réservé aux clientes Woman for Woman une fois vos
              modifications enregistrées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaveOpen) onChange(leaveOpen);
                setLeaveOpen(null);
                setOpen(false);
              }}
            >
              Quitter le mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const THEME_COUNT = BOOKING_THEMES.length;
