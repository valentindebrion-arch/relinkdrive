/**
 * « Ma vitrine » — éditeur visuel de la page publique du chauffeur.
 *
 * Le chauffeur voit sa véritable vitrine (mêmes composants que
 * `/chauffeur/$slug`) et l'édite bloc par bloc. Une seule source de données :
 * `profiles`, `driver_profiles`, `vehicles`, `driver_tariffs`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  Heart,
  ImagePlus,
  MousePointerClick,
  Pencil,
  QrCode,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle } from "@/lib/driver-queries";
import { ensureVehicleRowId } from "@/lib/vehicle-row";
import { useSignedUrl, useSignedUrls } from "@/lib/storage";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { LANGUAGES, SERVICES, VEHICLE_CATEGORIES } from "@/lib/showcase";
import { showcaseCompletion, showcaseFromOwnRows } from "@/lib/showcase-model";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { VehicleShowcase } from "@/components/VehicleShowcase";
import {
  ShowcaseAbout,
  ShowcaseContactSection,
  ShowcaseHeader,
  ShowcaseLanguages,
  ShowcaseLinksSection,
  ShowcaseSectors,
  ShowcaseServices,
  ShowcaseTariffs,
  ShowcaseVehicleInfo,
} from "@/components/showcase/ShowcaseSections";

type SectionKey =
  | "identity"
  | "about"
  | "sectors"
  | "services"
  | "languages"
  | "vehicle"
  | "tariffs"
  | "contact"
  | "links";

const SECTION_TITLES: Record<SectionKey, string> = {
  identity: "Mes informations",
  about: "À propos de moi",
  sectors: "Mes secteurs d'intervention",
  services: "Mes prestations",
  languages: "Langues parlées",
  vehicle: "Mon véhicule",
  tariffs: "Mes tarifs",
  contact: "Mes moyens de contact",
  links: "Mes liens",
};

type Draft = {
  full_name: string;
  public_intro: string;
  city: string;
  zone: string;
  service_departments: string[];
  stations: string;
  airports: string;
  long_distance: boolean;
  services: string[];
  languages: string[];
  public_phone: string;
  show_public_phone: boolean;
  whatsapp_number: string;
  show_whatsapp: boolean;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  linkedin_url: string;
  brand: string;
  model: string;
  color: string;
  year: string;
  category: string;
  max_passengers: string;
  large_luggage_capacity: string;
  cabin_luggage_capacity: string;
  pets_policy: string;
  flags: Record<string, boolean>;
  price_per_km: string;
  minimum: string;
  pickup_pct: string;
};

const VEHICLE_FLAGS: [string, string][] = [
  ["air_conditioning", "Climatisation"],
  ["chargers", "Chargeurs téléphone"],
  ["water", "Bouteilles d'eau"],
  ["card_payment", "Paiement par carte"],
  ["quiet_ride", "Trajet silencieux sur demande"],
  ["luggage_help", "Aide aux bagages"],
  ["child_seat", "Siège enfant"],
  ["booster_seat", "Rehausseur"],
  ["stroller_space", "Espace poussette"],
  ["accessible", "Accessible en fauteuil roulant"],
  ["large_trunk", "Grand coffre"],
];

const PHOTO_SLOTS = [
  { field: "photo_url", kind: "exterior", label: "Photo extérieure" },
  { field: "photo_side_url", kind: "side", label: "Vue de côté" },
  { field: "photo_front_url", kind: "front", label: "Vue de face" },
  { field: "photo_interior_url", kind: "interior", label: "Intérieur" },
] as const;

type PhotoField = (typeof PHOTO_SLOTS)[number]["field"];

const numOrNull = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
};

const EMPTY_DRAFT: Draft = {
  full_name: "",
  public_intro: "",
  city: "",
  zone: "",
  service_departments: [],
  stations: "",
  airports: "",
  long_distance: false,
  services: [],
  languages: [],
  public_phone: "",
  show_public_phone: false,
  whatsapp_number: "",
  show_whatsapp: false,
  website_url: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  linkedin_url: "",
  brand: "",
  model: "",
  color: "",
  year: "",
  category: "",
  max_passengers: "",
  large_luggage_capacity: "",
  cabin_luggage_capacity: "",
  pets_policy: "refused",
  flags: {},
  price_per_km: "",
  minimum: "",
  pickup_pct: "",
};

export function ShowcaseEditor() {
  const { user, profile, refresh } = useAuth();
  const driver = useDriverProfile();
  const vehicle = useMyVehicle();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [section, setSection] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [busyPhoto, setBusyPhoto] = useState<PhotoField | "avatar" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [origin, setOrigin] = useState("");

  const tariff = useQuery({
    queryKey: ["my-tariff", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_tariffs")
        .select("*")
        .eq("driver_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const stats = useQuery({
    queryKey: ["driver-visibility-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_driver_visibility_stats", { _days: 30 });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);

  // Chargement initial : le brouillon reflète exactement les données publiées.
  useEffect(() => {
    if (dirty) return;
    const d = (driver.data ?? {}) as Record<string, unknown>;
    const v = (vehicle.data ?? {}) as Record<string, unknown>;
    const t = (tariff.data ?? {}) as Record<string, unknown>;
    const next: Draft = {
      full_name: profile?.full_name ?? "",
      public_intro: (d["public_intro"] as string) ?? "",
      city: (d["city"] as string) ?? "",
      zone: (d["zone"] as string) ?? "",
      service_departments: ((d["service_departments"] as string[]) ?? []).slice(),
      stations: ((d["stations"] as string[]) ?? []).join(", "),
      airports: ((d["airports"] as string[]) ?? []).join(", "),
      long_distance: !!d["long_distance"],
      services: ((d["services"] as string[]) ?? []).slice(),
      languages: ((d["languages"] as string[]) ?? []).slice(),
      public_phone: (d["public_phone"] as string) ?? "",
      show_public_phone: !!d["show_public_phone"],
      whatsapp_number: (d["whatsapp_number"] as string) ?? "",
      show_whatsapp: !!d["show_whatsapp"],
      website_url: (d["website_url"] as string) ?? "",
      instagram_url: (d["instagram_url"] as string) ?? "",
      facebook_url: (d["facebook_url"] as string) ?? "",
      tiktok_url: (d["tiktok_url"] as string) ?? "",
      linkedin_url: (d["linkedin_url"] as string) ?? "",
      brand: (v["brand"] as string) ?? "",
      model: (v["model"] as string) ?? "",
      color: (v["color"] as string) ?? "",
      year: v["year"] ? String(v["year"]) : "",
      category: (v["category"] as string) ?? "",
      max_passengers: v["max_passengers"] ? String(v["max_passengers"]) : "",
      large_luggage_capacity:
        v["large_luggage_capacity"] == null ? "" : String(v["large_luggage_capacity"]),
      cabin_luggage_capacity:
        v["cabin_luggage_capacity"] == null ? "" : String(v["cabin_luggage_capacity"]),
      pets_policy: (v["pets_policy"] as string) ?? "refused",
      flags: Object.fromEntries(VEHICLE_FLAGS.map(([k]) => [k, !!v[k]])),
      price_per_km: t["price_per_km_ht"] == null ? "" : String(t["price_per_km_ht"]),
      minimum: t["minimum_ht"] == null ? "" : String(t["minimum_ht"]),
      pickup_pct: t["pickup_pct"] == null ? "" : String(t["pickup_pct"]),
    };
    const serialized = JSON.stringify(next);
    if (serialized !== JSON.stringify(baseline)) {
      setBaseline(next);
      setDraft(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, driver.data, vehicle.data, tariff.data]);

  useEffect(() => setOrigin(window.location.origin), []);

  const slug = (driver.data as { slug?: string } | null | undefined)?.slug ?? null;
  const publicUrl = slug && origin ? `${origin}/chauffeur/${slug}` : "";

  useEffect(() => {
    if (publicUrl && qrRef.current) {
      void QRCode.toCanvas(qrRef.current, publicUrl, { width: 200, margin: 1 });
    }
  }, [publicUrl]);

  // Aperçu strictement identique à la page publique, alimenté par le brouillon.
  const data = useMemo(
    () =>
      showcaseFromOwnRows({
        profile: { ...(profile ?? {}), full_name: draft.full_name },
        driver: {
          ...((driver.data ?? {}) as Record<string, unknown>),
          public_intro: draft.public_intro || null,
          city: draft.city || null,
          zone: draft.zone || null,
          service_departments: draft.service_departments,
          stations: draft.stations
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          airports: draft.airports
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          long_distance: draft.long_distance,
          services: draft.services,
          languages: draft.languages,
          public_phone: draft.public_phone || null,
          show_public_phone: draft.show_public_phone,
          whatsapp_number: draft.whatsapp_number || null,
          show_whatsapp: draft.show_whatsapp,
          website_url: draft.website_url || null,
          instagram_url: draft.instagram_url || null,
          facebook_url: draft.facebook_url || null,
          tiktok_url: draft.tiktok_url || null,
          linkedin_url: draft.linkedin_url || null,
        },
        vehicle: {
          ...((vehicle.data ?? {}) as Record<string, unknown>),
          brand: draft.brand || null,
          model: draft.model || null,
          color: draft.color || null,
          year: numOrNull(draft.year),
          category: draft.category || null,
          max_passengers: numOrNull(draft.max_passengers),
          large_luggage_capacity: numOrNull(draft.large_luggage_capacity),
          cabin_luggage_capacity: numOrNull(draft.cabin_luggage_capacity),
          pets_policy: draft.pets_policy,
          ...draft.flags,
        },
        tariff: draft.price_per_km
          ? {
              price_per_km_ht: numOrNull(draft.price_per_km),
              minimum_ht: numOrNull(draft.minimum),
              pickup_pct: numOrNull(draft.pickup_pct),
            }
          : null,
      }),
    [draft, profile, driver.data, vehicle.data],
  );

  const completion = showcaseCompletion(data);

  const photoPaths = PHOTO_SLOTS.map(
    (s) => ((vehicle.data ?? {}) as Record<string, string | null>)[s.field] ?? null,
  );
  const signed = useSignedUrls("vehicles", photoPaths);
  const photoUrl = (field: PhotoField) => {
    const path = ((vehicle.data ?? {}) as Record<string, string | null>)[field];
    return path ? (signed.data?.[path] ?? null) : null;
  };

  const rawAvatar = profile?.avatar_url ?? null;
  const avatarIsUrl = !!rawAvatar && /^https?:\/\//.test(rawAvatar);
  const signedAvatar = useSignedUrl("avatars", avatarIsUrl ? null : rawAvatar);
  const avatarUrl = avatarIsUrl ? rawAvatar : (signedAvatar.data ?? null);

  /* ------------------------------------------------------------ sauvegarde */

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    const toList = (v: string) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: draft.full_name })
      .eq("id", user.id);

    const { error: driverError } = await supabase
      .from("driver_profiles")
      .update({
        public_intro: draft.public_intro || null,
        city: draft.city || null,
        zone: draft.zone || null,
        service_departments: draft.service_departments,
        stations: toList(draft.stations),
        airports: toList(draft.airports),
        long_distance: draft.long_distance,
        services: draft.services,
        languages: draft.languages,
        public_phone: draft.public_phone || null,
        show_public_phone: draft.show_public_phone && !!draft.public_phone,
        whatsapp_number: draft.whatsapp_number || null,
        show_whatsapp: draft.show_whatsapp && !!draft.whatsapp_number,
        website_url: draft.website_url || null,
        instagram_url: draft.instagram_url || null,
        facebook_url: draft.facebook_url || null,
        tiktok_url: draft.tiktok_url || null,
        linkedin_url: draft.linkedin_url || null,
      })
      .eq("user_id", user.id);

    let vehicleError: { message: string } | null = null;
    if (
      draft.brand ||
      draft.model ||
      draft.category ||
      draft.max_passengers ||
      vehicle.data?.id
    ) {
      try {
        const vehicleId = await ensureVehicleRowId(user.id);
        const passengers = numOrNull(draft.max_passengers);
        const { error } = await supabase
          .from("vehicles")
          .update({
            brand: draft.brand || null,
            model: draft.model || null,
            color: draft.color || null,
            year: numOrNull(draft.year),
            category: draft.category || null,
            ...(passengers ? { max_passengers: passengers } : {}),
            large_luggage_capacity: numOrNull(draft.large_luggage_capacity),
            cabin_luggage_capacity: numOrNull(draft.cabin_luggage_capacity),
            pets_policy: draft.pets_policy,
            pets_allowed: draft.pets_policy !== "refused",
            ...draft.flags,
          })
          .eq("id", vehicleId);
        vehicleError = error;
      } catch {
        vehicleError = { message: "Votre véhicule n'a pas pu être enregistré." };
      }
    }

    let tariffError: { message: string } | null = null;
    const perKm = numOrNull(draft.price_per_km);
    if (perKm) {
      const { error } = await supabase.from("driver_tariffs").upsert(
        {
          driver_id: user.id,
          price_per_km_ht: perKm,
          minimum_ht: numOrNull(draft.minimum) ?? 0,
          pickup_pct: numOrNull(draft.pickup_pct) ?? 0,
        },
        { onConflict: "driver_id" },
      );
      tariffError = error;
    }

    setSaving(false);
    const failure = profileError ?? driverError ?? vehicleError ?? tariffError;
    if (failure) {
      toast.error(failure.message);
      return;
    }
    setBaseline(draft);
    setSavedAt(Date.now());
    toast.success("Votre vitrine a été mise à jour");
    await refresh();
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    void qc.invalidateQueries({ queryKey: ["my-tariff"] });
    void qc.invalidateQueries({ queryKey: ["public-driver"] });
  }

  /* ------------------------------------------------------------- photos */

  const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  async function uploadVehiclePhoto(file: File, field: PhotoField, kind: string): Promise<void> {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format d'image non pris en charge.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo trop lourde (8 Mo maximum).");
      return;
    }
    setBusyPhoto(field);
    const previous = ((vehicle.data ?? {}) as Record<string, string | null>)[field] ?? null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    let vehicleId: string;
    try {
      vehicleId = await ensureVehicleRowId(user!.id);
    } catch {
      setBusyPhoto(null);
      toast.error("La photo n'a pas pu être enregistrée.");
      return;
    }
    const path = `${user!.id}/vehicles/${vehicleId}/${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("vehicles")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setBusyPhoto(null);
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo est conservée.");
      return;
    }
    const { error: dbError } = await supabase
      .from("vehicles")
      .update({ [field]: path } as Record<PhotoField, string>)
      .eq("id", vehicleId);
    setBusyPhoto(null);
    if (dbError) {
      await supabase.storage.from("vehicles").remove([path]);
      toast.error("La photo n'a pas pu être enregistrée. Votre ancienne photo est conservée.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    void qc.invalidateQueries({ queryKey: ["signed-urls", "vehicles"] });
    if (previous && previous !== path) {
      await supabase.storage.from("vehicles").remove([previous]);
    }
    toast.success("Photo enregistrée");
  }

  async function removeVehiclePhoto(field: PhotoField): Promise<void> {
    const current = ((vehicle.data ?? {}) as Record<string, string | null>)[field];
    if (!current || !vehicle.data?.id) return;
    if (!window.confirm("Supprimer définitivement cette photo ?")) return;
    setBusyPhoto(field);
    const { error } = await supabase
      .from("vehicles")
      .update({ [field]: null } as Record<PhotoField, null>)
      .eq("id", vehicle.data.id);
    setBusyPhoto(null);
    if (error) {
      toast.error("La suppression a échoué. Votre photo est conservée.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-vehicle"] });
    await supabase.storage.from("vehicles").remove([current]);
    toast.success("Photo supprimée");
  }

  async function uploadAvatar(file: File): Promise<void> {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format d'image non pris en charge.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo trop lourde (8 Mo maximum).");
      return;
    }
    setBusyPhoto("avatar");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user!.id}/avatar/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setBusyPhoto(null);
      toast.error("La photo n'a pas pu être enregistrée.");
      return;
    }
    const previous = rawAvatar && !avatarIsUrl ? rawAvatar : null;
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", user!.id);
    setBusyPhoto(null);
    if (dbError) {
      await supabase.storage.from("avatars").remove([path]);
      toast.error("La photo n'a pas pu être enregistrée.");
      return;
    }
    await refresh();
    if (previous) await supabase.storage.from("avatars").remove([previous]);
    toast.success("Photo de profil enregistrée");
  }

  /* -------------------------------------------- garde « non enregistré » */

  const blocker = useBlocker({ shouldBlockFn: () => dirty, withResolver: true });

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const editing = mode === "edit";
  const open = (key: SectionKey) => () => setSection(key);
  const edit = (key: SectionKey) => (editing ? open(key) : undefined);

  function scrollToSection(id: string) {
    document.getElementById(`vitrine-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function share() {
    if (!publicUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Ma vitrine ${BRAND.name}`, url: publicUrl });
        return;
      } catch {
        /* partage annulé */
      }
    }
    void navigator.clipboard.writeText(publicUrl);
    toast.success("Lien copié");
  }

  function downloadQr() {
    const canvas = qrRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${slug ?? "relink"}.png`;
    a.click();
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((p) => ({ ...p, [key]: value }));

  const toggleIn = (key: "services" | "languages" | "service_departments", value: string) =>
    setDraft((p) => {
      const current = p[key];
      return {
        ...p,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });

  return (
    <div className="pb-28">
      {/* Barre de mode */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`tap-active min-h-10 flex-1 rounded-xl px-3 text-sm font-semibold transition ${
            editing ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Pencil className="mr-1.5 inline size-3.5" /> Modifier ma vitrine
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`tap-active min-h-10 flex-1 rounded-xl px-3 text-sm font-semibold transition ${
            !editing ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Eye className="mr-1.5 inline size-3.5" /> Voir comme un client
        </button>
      </div>

      {/* Complétude */}
      {editing ? (
        <button
          type="button"
          onClick={() => completion.nextStep && scrollToSection(completion.nextStep.id)}
          className="surface mb-4 w-full p-4 text-left"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">
              {completion.nextStep
                ? `Votre vitrine est complète à ${completion.pct} %`
                : "✓ Votre vitrine est complète"}
            </p>
            <span className="text-sm font-bold tabular-nums text-primary">{completion.pct} %</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${completion.pct}%` }}
            />
          </div>
          {completion.nextStep ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Prochaine étape : {completion.nextStep.next}
            </p>
          ) : null}
        </button>
      ) : null}

      <div className="space-y-3">
        <ShowcaseHeader
          data={data}
          avatarUrl={avatarUrl}
          {...(editing ? { onEditPhoto: () => avatarInput.current?.click() } : {})}
          {...(editing ? { onEditIdentity: open("identity") } : {})}
        />
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadAvatar(file);
          }}
        />

        <ShowcaseAbout about={data.about} {...(edit("about") ? { onEdit: open("about") } : {})} />
        <ShowcaseSectors data={data} {...(editing ? { onEdit: open("sectors") } : {})} />
        <ShowcaseServices
          services={data.services}
          longDistance={data.longDistance}
          {...(editing ? { onEdit: open("services") } : {})}
        />
        <ShowcaseLanguages
          languages={data.languages}
          {...(editing ? { onEdit: open("languages") } : {})}
        />

        {/* Photos du véhicule */}
        <section id="vitrine-photos" className="scroll-mt-24 space-y-3">
          <VehicleShowcase
            loading={signed.isLoading}
            overlay={data.vehicle.maxPassengers ? `${data.vehicle.maxPassengers} places` : null}
            photos={PHOTO_SLOTS.map((s) => ({
              key: s.field,
              url: photoUrl(s.field),
              label: s.label,
            }))}
          />
          {editing ? (
            <div className="surface p-5">
              <h2 className="text-base font-semibold">Photos du véhicule</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {PHOTO_SLOTS.map((s) => (
                  <PhotoSlot
                    key={s.field}
                    label={s.label}
                    url={photoUrl(s.field)}
                    busy={busyPhoto === s.field}
                    onSelect={(file) => void uploadVehiclePhoto(file, s.field, s.kind)}
                    onRemove={() => void removeVehiclePhoto(s.field)}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Les photos sont enregistrées immédiatement. Aucune image générique n'est ajoutée à
                votre place.
              </p>
            </div>
          ) : null}
        </section>

        <ShowcaseVehicleInfo
          vehicle={data.vehicle}
          {...(editing ? { onEdit: open("vehicle") } : {})}
        />
        <ShowcaseTariffs tariff={data.tariff} {...(editing ? { onEdit: open("tariffs") } : {})} />
        <ShowcaseContactSection
          title={`Contacter ${data.firstName}`}
          contact={data.contact}
          intro={`${BRAND.name} ne gère ni la réservation ni la course : vos clients échangent directement avec vous.`}
          {...(editing ? { onEdit: open("contact") } : {})}
        />
        <ShowcaseLinksSection links={data.links} {...(editing ? { onEdit: open("links") } : {})} />

        {/* QR code et lien */}
        <section className="surface p-5">
          <h2 className="text-base font-semibold">
            <QrCode className="mr-1.5 inline size-4" /> Mon QR code {BRAND.name}
          </h2>
          {publicUrl ? (
            <div className="mt-3 flex flex-col items-center gap-3">
              <canvas ref={qrRef} className="rounded-xl bg-white p-2" />
              <p className="text-center text-sm text-muted-foreground">
                Scannez pour découvrir ma vitrine {BRAND.name}
              </p>
              <div className="grid w-full gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(publicUrl);
                    toast.success("Lien copié");
                  }}
                >
                  <Copy className="size-4" /> Copier le lien
                </Button>
                <Button variant="outline" onClick={() => void share()}>
                  <Share2 className="size-4" /> Partager
                </Button>
                <Button onClick={downloadQr}>
                  <Download className="size-4" /> Télécharger
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Votre lien {BRAND.name} personnel</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Votre lien et votre QR code seront générés une fois votre dossier vérifié.
            </p>
          )}
        </section>

        {/* Visibilité */}
        {editing ? (
          <section className="surface p-5">
            <h2 className="text-base font-semibold">Ma visibilité · 30 derniers jours</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat
                icon={Eye}
                label="Vues"
                value={Number(stats.data?.profile_views ?? 0)}
              />
              <MiniStat
                icon={ShieldCheck}
                label="Apparitions"
                value={Number(stats.data?.search_appearances ?? 0)}
              />
              <MiniStat
                icon={Heart}
                label="Ajouts"
                value={Number(stats.data?.network_adds ?? 0)}
              />
              <MiniStat
                icon={MousePointerClick}
                label="Clics contact"
                value={Number(stats.data?.contact_clicks ?? 0)}
              />
            </div>
          </section>
        ) : null}
      </div>

      {/* Barre d'enregistrement */}
      {editing && (dirty || savedAt) ? (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-30 px-4 sm:bottom-4">
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
            <p className="min-w-0 flex-1 text-xs font-semibold">
              {dirty ? (
                <span className="text-warning">Modifications non enregistrées</span>
              ) : (
                <span className="flex items-center gap-1 text-primary">
                  <Check className="size-3.5" /> Votre vitrine a été mise à jour
                </span>
              )}
            </p>
            {dirty ? (
              <Button size="sm" className="h-10" disabled={saving} onClick={() => void save()}>
                Enregistrer les modifications
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Feuilles d'édition */}
      <Sheet open={!!section} onOpenChange={(v) => !v && setSection(null)}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{section ? SECTION_TITLES[section] : ""}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            {section === "identity" ? (
              <>
                <Field label="Nom affiché">
                  <Input
                    value={draft.full_name}
                    maxLength={80}
                    onChange={(e) => set("full_name", e.target.value)}
                  />
                </Field>
                <Field label="Ville principale">
                  <Input
                    value={draft.city}
                    maxLength={60}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </Field>
                <Field label="Agglomération / zone">
                  <Input
                    value={draft.zone}
                    maxLength={80}
                    onChange={(e) => set("zone", e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {section === "about" ? (
              <Field label="Votre présentation publique">
                <Textarea
                  rows={7}
                  maxLength={800}
                  value={draft.public_intro}
                  placeholder="Chauffeur privé basé à…, je propose…"
                  onChange={(e) => set("public_intro", e.target.value)}
                />
              </Field>
            ) : null}

            {section === "sectors" ? (
              <DepartmentPicker
                selected={draft.service_departments}
                onToggle={(code) => toggleIn("service_departments", code)}
              >
                <Field label="Gares desservies (séparées par des virgules)">
                  <Input
                    value={draft.stations}
                    onChange={(e) => set("stations", e.target.value)}
                  />
                </Field>
                <Field label="Aéroports desservis (séparés par des virgules)">
                  <Input
                    value={draft.airports}
                    onChange={(e) => set("airports", e.target.value)}
                  />
                </Field>
                <ToggleRow
                  label="Je propose la longue distance"
                  checked={draft.long_distance}
                  onChange={(v) => set("long_distance", v)}
                />
              </DepartmentPicker>
            ) : null}

            {section === "services" ? (
              <div className="grid gap-2">
                {SERVICES.map((s) => (
                  <CheckRow
                    key={s.value}
                    label={s.label}
                    checked={draft.services.includes(s.value)}
                    onToggle={() => toggleIn("services", s.value)}
                  />
                ))}
              </div>
            ) : null}

            {section === "languages" ? (
              <div className="grid gap-2">
                {LANGUAGES.map((l) => (
                  <CheckRow
                    key={l}
                    label={l}
                    checked={draft.languages.includes(l)}
                    onToggle={() => toggleIn("languages", l)}
                  />
                ))}
              </div>
            ) : null}

            {section === "vehicle" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Marque">
                    <Input value={draft.brand} onChange={(e) => set("brand", e.target.value)} />
                  </Field>
                  <Field label="Modèle">
                    <Input value={draft.model} onChange={(e) => set("model", e.target.value)} />
                  </Field>
                  <Field label="Couleur">
                    <Input value={draft.color} onChange={(e) => set("color", e.target.value)} />
                  </Field>
                  <Field label="Année">
                    <Input
                      inputMode="numeric"
                      value={draft.year}
                      onChange={(e) => set("year", e.target.value)}
                    />
                  </Field>
                  <Field label="Places">
                    <Input
                      inputMode="numeric"
                      value={draft.max_passengers}
                      onChange={(e) => set("max_passengers", e.target.value)}
                    />
                  </Field>
                  <Field label="Grandes valises">
                    <Input
                      inputMode="numeric"
                      value={draft.large_luggage_capacity}
                      onChange={(e) => set("large_luggage_capacity", e.target.value)}
                    />
                  </Field>
                  <Field label="Bagages cabine">
                    <Input
                      inputMode="numeric"
                      value={draft.cabin_luggage_capacity}
                      onChange={(e) => set("cabin_luggage_capacity", e.target.value)}
                    />
                  </Field>
                  <Field label="Catégorie">
                    <select
                      value={draft.category}
                      onChange={(e) => set("category", e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Non renseignée</option>
                      {VEHICLE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Animaux">
                  <select
                    value={draft.pets_policy}
                    onChange={(e) => set("pets_policy", e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="refused">Non acceptés</option>
                    <option value="accepted">Acceptés</option>
                    <option value="conditional">Acceptés sous conditions</option>
                  </select>
                </Field>
                <div className="grid gap-2">
                  {VEHICLE_FLAGS.map(([key, label]) => (
                    <CheckRow
                      key={key}
                      label={label}
                      checked={!!draft.flags[key]}
                      onToggle={() =>
                        setDraft((p) => ({
                          ...p,
                          flags: { ...p.flags, [key]: !p.flags[key] },
                        }))
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}

            {section === "tariffs" ? (
              <>
                <Field label="Prix au kilomètre (€)">
                  <Input
                    inputMode="decimal"
                    value={draft.price_per_km}
                    onChange={(e) => set("price_per_km", e.target.value)}
                  />
                </Field>
                <Field label="Course minimum (€)">
                  <Input
                    inputMode="decimal"
                    value={draft.minimum}
                    onChange={(e) => set("minimum", e.target.value)}
                  />
                </Field>
                <Field label="Prise en charge (%)">
                  <Input
                    inputMode="decimal"
                    value={draft.pickup_pct}
                    onChange={(e) => set("pickup_pct", e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            {section === "contact" ? (
              <>
                <Field label="Téléphone professionnel">
                  <Input
                    value={draft.public_phone}
                    maxLength={20}
                    placeholder="+33 6 12 34 56 78"
                    onChange={(e) => set("public_phone", e.target.value)}
                  />
                </Field>
                <ToggleRow
                  label="Afficher mon téléphone sur ma vitrine"
                  checked={draft.show_public_phone}
                  onChange={(v) => set("show_public_phone", v)}
                />
                <Field label="WhatsApp">
                  <Input
                    value={draft.whatsapp_number}
                    maxLength={20}
                    onChange={(e) => set("whatsapp_number", e.target.value)}
                  />
                </Field>
                <ToggleRow
                  label="Afficher WhatsApp sur ma vitrine"
                  checked={draft.show_whatsapp}
                  onChange={(v) => set("show_whatsapp", v)}
                />
                <Field label="Site internet">
                  <Input
                    value={draft.website_url}
                    maxLength={200}
                    placeholder="https://…"
                    onChange={(e) => set("website_url", e.target.value)}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Votre e-mail de compte est proposé aux visiteurs uniquement si vous l'avez
                  renseigné dans votre compte.
                </p>
              </>
            ) : null}

            {section === "links" ? (
              <>
                <Field label="Instagram">
                  <Input
                    value={draft.instagram_url}
                    maxLength={200}
                    placeholder="https://instagram.com/…"
                    onChange={(e) => set("instagram_url", e.target.value)}
                  />
                </Field>
                <Field label="Facebook">
                  <Input
                    value={draft.facebook_url}
                    maxLength={200}
                    onChange={(e) => set("facebook_url", e.target.value)}
                  />
                </Field>
                <Field label="TikTok">
                  <Input
                    value={draft.tiktok_url}
                    maxLength={200}
                    onChange={(e) => set("tiktok_url", e.target.value)}
                  />
                </Field>
                <Field label="LinkedIn">
                  <Input
                    value={draft.linkedin_url}
                    maxLength={200}
                    onChange={(e) => set("linkedin_url", e.target.value)}
                  />
                </Field>
              </>
            ) : null}

            <Button className="h-12 w-full" onClick={() => setSection(null)}>
              Valider
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non enregistrées. Voulez-vous quitter sans enregistrer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Continuer la modification
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              Quitter sans enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------- primitives */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`tap-active flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm transition ${
        checked ? "border-primary bg-primary/5 font-semibold" : "border-border"
      }`}
    >
      {label}
      {checked ? <Check className="size-4 text-primary" /> : null}
    </button>
  );
}

function DepartmentPicker({
  selected,
  onToggle,
  children,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  children?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const entries = Object.entries(DEPARTMENT_NAMES).filter(([code, name]) => {
    const s = q.trim().toLowerCase();
    return !s || code.toLowerCase().startsWith(s) || name.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-3">
      <Field label="Rechercher un département">
        <Input value={q} placeholder="63, Puy-de-Dôme…" onChange={(e) => setQ(e.target.value)} />
      </Field>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
        {entries.map(([code, name]) => (
          <CheckRow
            key={code}
            label={`${name} (${code})`}
            checked={selected.includes(code)}
            onToggle={() => onToggle(code)}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

function PhotoSlot({
  label,
  url,
  busy,
  onSelect,
  onRemove,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="relative block aspect-[4/3] w-full bg-muted"
      >
        {url ? (
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImagePlus className="size-5" />
            <span className="text-[11px] font-semibold">+ Ajouter</span>
          </span>
        )}
        {busy ? <span className="absolute inset-0 animate-pulse bg-background/60" /> : null}
      </button>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Changer : ${label}`}
            onClick={() => input.current?.click()}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Camera className="size-3.5" />
          </button>
          {url ? (
            <button
              type="button"
              aria-label={`Supprimer : ${label}`}
              onClick={onRemove}
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onSelect(file);
        }}
      />
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
