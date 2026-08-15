import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Monitor,
  Smartphone,
  Sparkles,
  Tablet,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { useSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  BOOKING_THEMES,
  DEFAULT_BOOKING_THEME,
  getBookingTheme,
  normalizeBookingTheme,
  type BookingThemeId,
} from "@/lib/booking-themes";
import { BookingThemeScope, PoweredByRelink } from "@/components/BookingThemeScope";

export const Route = createFileRoute("/_authenticated/pro/personnalisation")({
  head: () => ({
    meta: [
      { title: "Thème de réservation — ReLink" },
      {
        name: "description",
        content:
          "Choisissez le thème visuel appliqué au parcours de réservation de vos clients ReLink.",
      },
      { property: "og:title", content: "Thème de réservation — ReLink" },
      {
        property: "og:description",
        content: "Personnalisez l'univers visuel de votre page chauffeur et de vos réservations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalisationPage,
});

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type DeviceMode = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTH: Record<DeviceMode, number> = {
  mobile: 390,
  tablet: 620,
  desktop: 900,
};

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="size-5 rounded-full border border-border"
          style={{ background: c }}
          aria-hidden
        />
      ))}
    </div>
  );
}

/** Aperçu réaliste du parcours client — aucune donnée n'est créée ni modifiée. */
function BookingPreview({
  themeId,
  displayName,
  welcome,
  logoUrl,
  coverUrl,
  vehicle,
  device,
}: {
  themeId: BookingThemeId;
  displayName: string;
  welcome: string;
  logoUrl: string | null;
  coverUrl: string | null;
  vehicle: string;
  device: DeviceMode;
}) {
  const theme = getBookingTheme(themeId);
  return (
    <div className="mx-auto w-full" style={{ maxWidth: DEVICE_WIDTH[device] }}>
      <BookingThemeScope theme={themeId} className="overflow-hidden rounded-2xl border border-border">
        {/* Bandeau supérieur */}
        <div className="relative" style={{ background: theme.banner }}>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-35"
              aria-hidden
            />
          ) : null}
          <div className="relative flex items-center gap-3 p-5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo de ${displayName}`}
                className="size-12 rounded-xl border border-white/30 object-cover"
              />
            ) : (
              <span className="grid size-12 place-items-center rounded-xl border border-white/30 bg-white/15 text-sm font-bold text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/85">{welcome}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Barre de progression */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i === 0 ? "var(--theme-primary)" : "var(--theme-border)" }}
              />
            ))}
          </div>

          {/* Onglets Maintenant / Planifier */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <span className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              <Clock className="size-4" /> Maintenant
            </span>
            <span className="flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground">
              <CalendarClock className="size-4" /> Planifier
            </span>
          </div>

          {/* Champs d'adresse */}
          <div className="surface space-y-2 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <MapPin className="size-4 text-primary" />
              <span className="text-muted-foreground">Adresse de départ</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <MapPin className="size-4 text-primary" />
              <span className="text-muted-foreground">Adresse d'arrivée</span>
            </div>
          </div>

          {/* Carte véhicule + badge décoratif */}
          <div className="surface flex items-center justify-between gap-3 p-3 text-sm">
            <span className="font-medium">{vehicle}</span>
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              Chauffeur vérifié
            </span>
          </div>

          {/* États fonctionnels : couleur + icône + libellé */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 font-medium text-success">
              <Check className="size-3.5" /> Confirmée
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 font-medium text-warning-foreground">
              <Clock className="size-3.5" /> En attente
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 font-medium text-destructive">
              <X className="size-3.5" /> Erreur : adresse manquante
            </span>
          </div>

          <Button className="min-h-12 w-full text-base">Demander cette course</Button>
          <PoweredByRelink className="py-1" />
        </div>
      </BookingThemeScope>
    </div>
  );
}

function PersonalisationPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const queryClient = useQueryClient();
  const d = driver.data as Record<string, unknown> | null | undefined;

  const savedTheme = normalizeBookingTheme(d?.["booking_theme"]);
  const eligible = Boolean(d?.["women_for_women_eligible"]);

  const [selected, setSelected] = useState<BookingThemeId>(savedTheme);
  const [previewTheme, setPreviewTheme] = useState<BookingThemeId | null>(null);
  const [device, setDevice] = useState<DeviceMode>("mobile");
  const [saving, setSaving] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState<null | "logo" | "cover">(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!d || hydrated.current) return;
    hydrated.current = true;
    setSelected(normalizeBookingTheme(d["booking_theme"]));
    setBrandName((d["brand_display_name"] as string | null) ?? "");
    setWelcome((d["brand_welcome_message"] as string | null) ?? "");
    setLogoPath((d["brand_logo_path"] as string | null) ?? null);
    setCoverPath((d["brand_cover_path"] as string | null) ?? null);
  }, [d]);

  const logoUrl = useSignedUrl("branding", logoPath ?? undefined).data ?? null;
  const coverUrl = useSignedUrl("branding", coverPath ?? undefined).data ?? null;

  const displayName = useMemo(
    () => brandName.trim() || (d?.["business_name"] as string | null) || "Votre nom commercial",
    [brandName, d],
  );
  const welcomeText = welcome.trim() || "Bienvenue, réservez votre course en quelques secondes.";

  async function upload(kind: "logo" | "cover", file: File) {
    if (!user?.id) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Format non autorisé. Utilisez un fichier PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image trop volumineuse (2 Mo maximum).");
      return;
    }
    setUploading(kind);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("branding")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      if (kind === "logo") setLogoPath(path);
      else setCoverPath(path);
      toast.success("Image ajoutée. Pensez à enregistrer.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setUploading(null);
    }
  }

  async function save(themeOverride?: BookingThemeId) {
    if (!user?.id || saving) return;
    const nextTheme = themeOverride ?? selected;
    if (nextTheme === "women_for_women" && !eligible) {
      toast.error("Ce thème est réservé aux chauffeurs éligibles au programme Women for Women.");
      return;
    }
    setSaving(true);
    const previous = savedTheme;
    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          booking_theme: nextTheme,
          brand_display_name: brandName.trim() || null,
          brand_welcome_message: welcome.trim().slice(0, 120) || null,
          brand_logo_path: logoPath,
          brand_cover_path: coverPath,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      setSelected(nextTheme);
      await queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["driver-branding"] });
      toast.success("Votre thème de réservation a été mis à jour.");
    } catch (error) {
      setSelected(previous);
      toast.error(
        error instanceof Error
          ? `Enregistrement impossible : ${error.message}`
          : "Enregistrement impossible. Votre thème précédent est conservé.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <Link to="/pro/profil" className="grid size-10 place-items-center rounded-xl border border-border">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Thème de réservation</h1>
          <p className="text-xs text-muted-foreground">
            Personnalisez l'univers visuel vu par vos clients. Le parcours, les étapes et les prix
            restent identiques.
          </p>
        </div>
      </div>

      {/* Identité de marque */}
      <section className="surface space-y-3 p-5">
        <h2 className="text-base font-semibold">Votre marque</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="brand-name">Nom commercial</Label>
            <Input
              id="brand-name"
              value={brandName}
              maxLength={60}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ex. Atlas Privé"
            />
          </div>
          <div>
            <Label htmlFor="brand-welcome">Phrase d'accueil (120 caractères max.)</Label>
            <Input
              id="brand-welcome"
              value={welcome}
              maxLength={120}
              onChange={(e) => setWelcome(e.target.value)}
              placeholder="Bienvenue, votre trajet en toute sérénité."
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { kind: "logo" as const, label: "Logo professionnel", url: logoUrl, ref: logoInput },
              { kind: "cover" as const, label: "Photo de couverture", url: coverUrl, ref: coverInput },
            ]
          ).map((item) => (
            <div key={item.kind} className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">{item.label}</p>
              <div className="mt-2 flex items-center gap-3">
                {item.url ? (
                  <img src={item.url} alt="" className="size-14 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-14 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </span>
                )}
                <input
                  ref={item.ref}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(item.kind, f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading === item.kind}
                  onClick={() => item.ref.current?.click()}
                >
                  {uploading === item.kind ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1 size-4" />
                  )}
                  Choisir
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">PNG, JPEG ou WebP · 2 Mo maximum.</p>
            </div>
          ))}
        </div>
      </section>

      {/* Thèmes */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Thèmes disponibles</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {BOOKING_THEMES.map((theme) => {
            const locked = theme.restricted === "women_for_women" && !eligible;
            const active = savedTheme === theme.id;
            return (
              <article
                key={theme.id}
                className={cn(
                  "surface flex flex-col gap-3 p-4",
                  active && "ring-2 ring-primary",
                  locked && "opacity-80",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{theme.name}</h3>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          <Check className="size-3" /> Thème actuel
                        </span>
                      ) : null}
                      {locked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          <Lock className="size-3" /> Réservé
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{theme.mood}</p>
                  </div>
                  <Swatches colors={theme.swatches} />
                </div>

                <p className="text-sm text-muted-foreground">{theme.description}</p>

                {/* Aperçu miniature */}
                <BookingThemeScope
                  theme={theme.id}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <div className="h-10" style={{ background: theme.banner }} />
                  <div className="space-y-2 p-3">
                    <div className="h-2 w-24 rounded-full bg-muted" />
                    <div className="surface p-2 text-xs text-muted-foreground">Adresse de départ</div>
                    <div className="flex h-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                      Demander cette course
                    </div>
                  </div>
                </BookingThemeScope>

                {locked ? (
                  <p className="flex items-start gap-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    <Lock className="mt-0.5 size-3.5 shrink-0" />
                    Réservé aux chauffeurs éligibles au programme Women for Women.
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => {
                      setPreviewTheme(theme.id);
                      setSelected(theme.id);
                    }}
                    disabled={locked}
                  >
                    <Sparkles className="mr-1 size-4" /> Prévisualiser
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-10"
                    disabled={locked || saving || active}
                    onClick={() => void save(theme.id)}
                  >
                    {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                    {active ? "Thème actuel" : "Utiliser ce thème"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={saving || savedTheme === DEFAULT_BOOKING_THEME}
          onClick={() => void save(DEFAULT_BOOKING_THEME)}
        >
          Revenir au thème ReLink classique
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
          Enregistrer mes informations
        </Button>
      </div>

      {/* Aperçu en direct */}
      {previewTheme ? (
        <section className="surface space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Aperçu — {getBookingTheme(previewTheme).name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Simulation : aucune course n'est créée et aucune donnée client n'est modifiée.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ["mobile", Smartphone, "Mobile"],
                  ["tablet", Tablet, "Tablette"],
                  ["desktop", Monitor, "Ordinateur"],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={label}
                  onClick={() => setDevice(mode)}
                  className={cn(
                    "flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium",
                    device === mode ? "bg-card shadow-sm" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>
          <BookingPreview
            themeId={previewTheme}
            displayName={displayName}
            welcome={welcomeText}
            logoUrl={logoUrl}
            coverUrl={coverUrl}
            vehicle="Berline · 4 passagers · 3 bagages"
            device={device}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void save(previewTheme)}
              disabled={saving || savedTheme === previewTheme}
            >
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Utiliser ce thème
            </Button>
            <Button variant="ghost" onClick={() => setPreviewTheme(null)}>
              Fermer l'aperçu
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
