/**
 * Blocs de la vitrine chauffeur ReLink.
 *
 * Ces composants sont utilisés à l'identique par la page publique
 * (`/chauffeur/$slug`) et par l'éditeur « Ma vitrine » (`/pro`). Sans prop
 * `onEdit`, le rendu est strictement public. Avec `onEdit`, un crayon discret
 * apparaît et les blocs vides deviennent des emplacements « + Ajouter … ».
 */
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Car,
  CreditCard,
  Dog,
  Droplets,
  Facebook,
  Globe,
  Instagram,
  Languages as LanguagesIcon,
  Linkedin,
  Luggage,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Pencil,
  Phone,
  PlugZap,
  Plus,
  Quote,
  Snowflake,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabel, serviceLabel } from "@/lib/showcase";
import {
  departmentLabel,
  vehicleTitle,
  type ShowcaseContact,
  type ShowcaseData,
  type ShowcaseLinks,
  type ShowcaseTariff,
  type ShowcaseVehicle,
} from "@/lib/showcase-model";
import { WFW_LABEL, WFW_PUBLIC_HEADER_NOTICE } from "@/lib/woman-for-woman";

export function Chip({ icon: Icon, children }: { icon?: typeof Car; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
      {Icon ? <Icon className="size-3.5 text-primary" /> : null}
      {children}
    </span>
  );
}

function EditPencil({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="tap-active inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
    >
      <Pencil className="size-3.5" /> Modifier
    </button>
  );
}

/**
 * Coque commune d'une section de vitrine.
 * `isEmpty` + `onEdit` → emplacement à compléter. `isEmpty` sans `onEdit` → rien.
 */
export function ShowcaseSection({
  id,
  title,
  onEdit,
  isEmpty,
  emptyHint,
  emptyCta,
  children,
}: {
  id: string;
  title: string;
  onEdit?: (() => void) | undefined;
  isEmpty?: boolean;
  emptyHint?: string;
  emptyCta?: string;
  children?: ReactNode;
}) {
  if (isEmpty && !onEdit) return null;
  return (
    <section id={`vitrine-${id}`} className="surface scroll-mt-24 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {onEdit && !isEmpty ? <EditPencil label={`Modifier : ${title}`} onClick={onEdit} /> : null}
      </div>
      {isEmpty ? (
        <div className="mt-3">
          {emptyHint ? <p className="text-sm text-muted-foreground">{emptyHint}</p> : null}
          <Button variant="outline" className="mt-3 h-11 w-full" onClick={onEdit}>
            <Plus className="size-4" /> {emptyCta ?? "Ajouter"}
          </Button>
        </div>
      ) : (
        <div className="mt-3 text-sm">{children}</div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- en-tête */

export function ShowcaseHeader({
  data,
  avatarUrl,
  subtitle,
  onEditPhoto,
  onEditIdentity,
}: {
  data: ShowcaseData;
  /** URL affichable de la photo (signée si elle vient du stockage). */
  avatarUrl: string | null;
  subtitle?: string | null;
  onEditPhoto?: () => void;
  onEditIdentity?: () => void;
}) {
  const initial = data.firstName.charAt(0).toUpperCase();
  return (
    <section className={`surface overflow-hidden${data.womanForWoman ? " wfw-card" : ""}`}>
      <div className="flex items-center gap-3.5 p-5 pb-4">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={data.firstName}
              className="size-20 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground">
              {initial}
            </div>
          )}
          {onEditPhoto ? (
            <button
              type="button"
              onClick={onEditPhoto}
              aria-label="Changer ma photo"
              className="tap-active absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border border-border bg-background text-primary shadow-sm"
            >
              <Camera className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-1.5 text-[24px] leading-tight font-black tracking-tight">
            <span className="truncate">
              {data.firstName}
              {data.lastInitial ? ` ${data.lastInitial}.` : ""}
            </span>
            <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Profil vérifié" />
          </h1>
          {data.city ? (
            <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-muted-foreground">
              <MapPin className="size-3.5" /> <span className="truncate">{data.city}</span>
            </p>
          ) : null}
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {subtitle ?? data.businessName ?? "Chauffeur VTC"}
          </p>
        </div>
        {onEditIdentity ? (
          <EditPencil label="Modifier mes informations" onClick={onEditIdentity} />
        ) : null}
      </div>
      {onEditPhoto && !avatarUrl ? (
        <button
          type="button"
          onClick={onEditPhoto}
          className="tap-active w-full border-t border-border px-5 py-3 text-left text-sm font-semibold text-primary"
        >
          + Ajouter une photo
        </button>
      ) : null}
      {data.womanForWoman ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <span className="wfw-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
              <Sparkles className="size-3.5" /> {WFW_LABEL}
            </span>
          </div>
          <p className="wfw-tint border-t border-border px-5 py-3 text-[12.5px] leading-snug text-muted-foreground">
            {WFW_PUBLIC_HEADER_NOTICE}
          </p>
        </>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------- à propos */

export function ShowcaseAbout({ about, onEdit }: { about: string | null; onEdit?: () => void }) {
  return (
    <ShowcaseSection
      id="about"
      title="À propos de moi"
      onEdit={onEdit}
      isEmpty={!about}
      emptyHint="Présentez votre activité aux futurs clients : votre expérience, votre manière de travailler, vos spécialités."
      emptyCta="Ajouter ma présentation"
    >
      <p className="flex gap-2 whitespace-pre-line text-muted-foreground">
        <Quote className="size-4 shrink-0 fill-primary text-primary" />
        {about}
      </p>
    </ShowcaseSection>
  );
}

/* ---------------------------------------------------------------- secteurs */

export function ShowcaseSectors({
  data,
  onEdit,
}: {
  data: Pick<
    ShowcaseData,
    "departments" | "serviceAreas" | "stations" | "airports" | "city" | "zone" | "longDistance"
  >;
  onEdit?: () => void;
}) {
  const empty =
    !data.departments.length &&
    !data.serviceAreas.length &&
    !data.stations.length &&
    !data.airports.length &&
    !data.city &&
    !data.zone;
  return (
    <ShowcaseSection
      id="sectors"
      title="Mes secteurs d'intervention"
      onEdit={onEdit}
      isEmpty={empty}
      emptyHint="Indiquez les départements dans lesquels vous travaillez : ils déterminent où les clients vous découvrent."
      emptyCta="Ajouter mes secteurs"
    >
      <div className="flex flex-wrap gap-2">
        {data.departments.map((d) => (
          <Chip key={`dep-${d}`} icon={MapPin}>
            {departmentLabel(d)}
          </Chip>
        ))}
        {data.city ? <Chip icon={MapPin}>{data.city}</Chip> : null}
        {data.zone ? <Chip icon={MapPin}>{data.zone}</Chip> : null}
        {data.serviceAreas.map((z) => (
          <Chip key={`area-${z}`}>{z}</Chip>
        ))}
        {data.stations.map((z) => (
          <Chip key={`st-${z}`}>Gare · {z}</Chip>
        ))}
        {data.airports.map((z) => (
          <Chip key={`ap-${z}`}>Aéroport · {z}</Chip>
        ))}
        {data.longDistance ? <Chip>Longue distance</Chip> : null}
      </div>
    </ShowcaseSection>
  );
}

/* ------------------------------------------------------------- prestations */

export function ShowcaseServices({
  services,
  longDistance,
  onEdit,
}: {
  services: string[];
  longDistance?: boolean;
  onEdit?: () => void;
}) {
  return (
    <ShowcaseSection
      id="services"
      title="Mes prestations"
      onEdit={onEdit}
      isEmpty={!services.length}
      emptyHint="Transferts aéroport, mise à disposition, événements… sélectionnez ce que vous proposez."
      emptyCta="Ajouter mes prestations"
    >
      <div className="flex flex-wrap gap-2">
        {services.map((s) => (
          <Chip key={s} icon={Briefcase}>
            {serviceLabel(s)}
          </Chip>
        ))}
        {longDistance ? <Chip icon={MapPin}>Longue distance</Chip> : null}
      </div>
    </ShowcaseSection>
  );
}

/* ------------------------------------------------------------------ langues */

export function ShowcaseLanguages({
  languages,
  onEdit,
}: {
  languages: string[];
  onEdit?: () => void;
}) {
  return (
    <ShowcaseSection
      id="languages"
      title="Langues parlées"
      onEdit={onEdit}
      isEmpty={!languages.length}
      emptyHint="Indiquez les langues dans lesquelles vous accueillez vos clients."
      emptyCta="Ajouter mes langues"
    >
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => (
          <Chip key={l} icon={LanguagesIcon}>
            {l}
          </Chip>
        ))}
      </div>
    </ShowcaseSection>
  );
}

/* ----------------------------------------------------------------- véhicule */

const EQUIPMENT_LABELS: { key: string; label: string; icon: typeof Car }[] = [
  { key: "air_conditioning", label: "Climatisation", icon: Snowflake },
  { key: "chargers", label: "Chargeurs téléphone", icon: PlugZap },
  { key: "water", label: "Bouteilles d'eau", icon: Droplets },
  { key: "card_payment", label: "Paiement par carte", icon: CreditCard },
  { key: "quiet_ride", label: "Trajet silencieux sur demande", icon: Volume2 },
  { key: "luggage_help", label: "Aide aux bagages", icon: Luggage },
  { key: "child_seat", label: "Siège enfant", icon: Car },
  { key: "booster_seat", label: "Rehausseur", icon: Car },
  { key: "stroller_space", label: "Espace poussette", icon: Car },
  { key: "accessible", label: "Accessible en fauteuil roulant", icon: Car },
  { key: "large_trunk", label: "Grand coffre", icon: Luggage },
];

export function ShowcaseVehicleInfo({
  vehicle,
  onEdit,
}: {
  vehicle: ShowcaseVehicle;
  onEdit?: () => void;
}) {
  const empty = !vehicle.brand && !vehicle.model && !vehicle.category;
  const equipments = EQUIPMENT_LABELS.filter((e) => vehicle.flags[e.key]);
  const subtitle = [categoryLabel(vehicle.category), vehicle.color, vehicle.year]
    .filter(Boolean)
    .join(" · ");
  return (
    <ShowcaseSection
      id="vehicle"
      title="Mon véhicule"
      onEdit={onEdit}
      isEmpty={empty}
      emptyHint="Marque, modèle, catégorie, places et bagages : ce que vos clients veulent savoir avant de vous contacter."
      emptyCta="Ajouter mon véhicule"
    >
      <p className="text-base font-semibold">{vehicleTitle(vehicle)}</p>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        <li>
          {vehicle.maxPassengers != null
            ? `Jusqu'à ${vehicle.maxPassengers} passagers`
            : "Capacité en passagers non renseignée"}
        </li>
        <li>
          {vehicle.largeLuggage != null
            ? `${vehicle.largeLuggage} grandes valises`
            : vehicle.luggage != null
              ? `${vehicle.luggage} bagages au total`
              : "Capacité en bagages non renseignée"}
        </li>
        {vehicle.cabinLuggage != null ? <li>{vehicle.cabinLuggage} bagages cabine</li> : null}
        <li>
          {vehicle.petsPolicy === "accepted"
            ? `Animaux acceptés${vehicle.petsMax ? ` (jusqu'à ${vehicle.petsMax})` : ""}`
            : vehicle.petsPolicy === "conditional"
              ? "Animaux sous conditions"
              : "Animaux non acceptés"}
        </li>
      </ul>
      {equipments.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {equipments.map((e) => (
            <Chip key={e.key} icon={e.icon}>
              {e.label}
            </Chip>
          ))}
        </div>
      ) : null}
      {vehicle.petsConditions && vehicle.petsPolicy === "conditional" ? (
        <p className="mt-2 text-xs text-muted-foreground">{vehicle.petsConditions}</p>
      ) : null}
    </ShowcaseSection>
  );
}

/* ------------------------------------------------------------------ tarifs */

const euro = (v: number | null | undefined) =>
  v == null ? null : `${v.toFixed(2).replace(/\.00$/, "").replace(".", ",")} €`;

export function ShowcaseTariffs({
  tariff,
  onEdit,
  locked,
  lockedHint,
}: {
  tariff: ShowcaseTariff | null;
  onEdit?: () => void;
  locked?: boolean;
  lockedHint?: string;
}) {
  return (
    <ShowcaseSection
      id="tariffs"
      title="Mes tarifs"
      onEdit={locked ? undefined : onEdit}
      isEmpty={!tariff?.pricePerKm}
      emptyHint="Prix au kilomètre et course minimum : ils alimentent l'estimation indicative de votre vitrine."
      emptyCta="Ajouter mes tarifs"
    >
      <ul className="space-y-1.5">
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Prix au kilomètre</span>
          <span className="font-semibold tabular-nums">{euro(tariff?.pricePerKm) ?? "—"}</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Course minimum</span>
          <span className="font-semibold tabular-nums">{euro(tariff?.minimum) ?? "—"}</span>
        </li>
        {tariff?.pickupPct ? (
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Prise en charge</span>
            <span className="font-semibold tabular-nums">{tariff.pickupPct} %</span>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        L'estimation affichée au client est une fourchette indicative. Le tarif définitif se convient
        directement entre vous et votre client.
      </p>
      {locked && lockedHint ? (
        <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {lockedHint}
        </p>
      ) : null}
    </ShowcaseSection>
  );
}

/* ----------------------------------------------------------------- contact */

export type ContactAction = {
  kind: string;
  label: string;
  href: string;
  icon: typeof Car;
  external?: boolean;
  primary?: boolean;
};

/** Moyens de contact publiés, dans l'ordre d'utilité. */
export function contactActions(contact: ShowcaseContact): ContactAction[] {
  const phone = contact.phone?.replace(/\s/g, "");
  const out: ContactAction[] = [];
  if (phone) {
    out.push({
      kind: "phone",
      label: `Appeler ${contact.phone}`,
      href: `tel:${phone}`,
      icon: Phone,
      primary: true,
    });
    out.push({ kind: "sms", label: "Envoyer un SMS", href: `sms:${phone}`, icon: MessageCircle });
  }
  if (contact.whatsapp) {
    out.push({
      kind: "whatsapp",
      label: "Écrire sur WhatsApp",
      href: `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`,
      icon: MessageCircle,
      external: true,
    });
  }
  if (contact.email) {
    out.push({
      kind: "email",
      label: contact.email,
      href: `mailto:${contact.email}`,
      icon: Mail,
    });
  }
  if (contact.website) {
    out.push({
      kind: "website",
      label: "Site internet",
      href: contact.website,
      icon: Globe,
      external: true,
    });
  }
  return out;
}

export function ShowcaseContactSection({
  title,
  contact,
  onEdit,
  onTrack,
  intro,
}: {
  title: string;
  contact: ShowcaseContact;
  onEdit?: () => void;
  onTrack?: (kind: string) => void;
  intro?: string;
}) {
  const actions = contactActions(contact);
  return (
    <ShowcaseSection
      id="contact"
      title={title}
      onEdit={onEdit}
      isEmpty={!actions.length}
      emptyHint="Téléphone, WhatsApp, e-mail ou site : choisissez ce que vos clients peuvent voir."
      emptyCta="Ajouter mes moyens de contact"
    >
      {intro ? <p className="mb-3 text-[13px] text-muted-foreground">{intro}</p> : null}
      <div className="space-y-2">
        {actions.map((c) => (
          <Button
            key={c.kind}
            asChild
            variant={c.primary ? "default" : "outline"}
            className="h-12 w-full justify-start text-base"
          >
            <a
              href={c.href}
              {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => onTrack?.(c.kind)}
            >
              <c.icon className="size-4" /> {c.label}
            </a>
          </Button>
        ))}
      </div>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------- liens */

export function ShowcaseLinksSection({
  links,
  onEdit,
  onTrack,
}: {
  links: ShowcaseLinks;
  onEdit?: () => void;
  onTrack?: (kind: string) => void;
}) {
  const items = [
    { kind: "instagram", label: "Instagram", href: links.instagram, icon: Instagram },
    { kind: "facebook", label: "Facebook", href: links.facebook, icon: Facebook },
    { kind: "tiktok", label: "TikTok", href: links.tiktok, icon: Music2 },
    { kind: "linkedin", label: "LinkedIn", href: links.linkedin, icon: Linkedin },
  ].filter((i) => !!i.href);
  return (
    <ShowcaseSection
      id="links"
      title="Mes liens"
      onEdit={onEdit}
      isEmpty={!items.length}
      emptyHint="Instagram, Facebook, TikTok, LinkedIn : montrez votre activité au-delà de ReLink."
      emptyCta="Ajouter un lien"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <Button key={i.kind} asChild variant="outline" className="h-11 justify-start">
            <a
              href={i.href!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrack?.(i.kind)}
            >
              <i.icon className="size-4" /> {i.label}
            </a>
          </Button>
        ))}
      </div>
    </ShowcaseSection>
  );
}
