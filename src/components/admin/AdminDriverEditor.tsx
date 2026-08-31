/**
 * Édition administrative d'un chauffeur : identité, vitrine, horaires et
 * tarifs. Les corrections écrivent dans les mêmes tables que l'espace
 * chauffeur, donc la vitrine publique, l'estimateur et le badge de
 * disponibilité reflètent le changement immédiatement.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Euro, IdCard, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { logAdminChange } from "@/lib/support-queries";
import {
  DAY_LABELS,
  parseWorkingHours,
  serializeWorkingHours,
  type WorkingDay,
} from "@/lib/working-hours";

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface mb-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {icon} {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function AdminDriverIdentityCard({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "driver-profile", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", driverId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data)
      setForm({
        full_name: data.full_name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
      });
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        })
        .eq("id", driverId);
      if (error) throw error;
      await logAdminChange({
        targetUserId: driverId,
        action: "admin.profile_update",
        field: "profiles",
        oldValue: data,
        newValue: form,
      });
      await qc.invalidateQueries();
      toast.success("Informations personnelles mises à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Informations personnelles" icon={<IdCard className="size-4 text-primary" />}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Prénom et nom
          <Input
            className="mt-1"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </label>
        <label className="text-sm">
          E-mail
          <Input
            className="mt-1"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Téléphone
          <Input
            className="mt-1"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
      </div>
      <Button className="mt-3 min-h-10" disabled={busy} onClick={() => void save()}>
        Enregistrer les modifications
      </Button>
    </Card>
  );
}

export function AdminDriverShowcaseCard({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    city: "",
    public_intro: "",
    public_phone: "",
    page_published: false,
  });

  const { data } = useQuery({
    queryKey: ["admin", "driver-showcase", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_profiles")
        .select("business_name, city, public_intro, public_phone, page_published, slug")
        .eq("user_id", driverId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data)
      setForm({
        business_name: data.business_name ?? "",
        city: data.city ?? "",
        public_intro: data.public_intro ?? "",
        public_phone: data.public_phone ?? "",
        page_published: Boolean(data.page_published),
      });
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          business_name: form.business_name.trim() || null,
          city: form.city.trim() || null,
          public_intro: form.public_intro.trim() || null,
          public_phone: form.public_phone.trim() || null,
          page_published: form.page_published,
        })
        .eq("user_id", driverId);
      if (error) throw error;
      await logAdminChange({
        targetUserId: driverId,
        action: "admin.showcase_update",
        field: "driver_profiles",
        oldValue: data,
        newValue: form,
      });
      await qc.invalidateQueries();
      toast.success("Vitrine mise à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Vitrine publique" icon={<Store className="size-4 text-primary" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Nom affiché
          <Input
            className="mt-1"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Ville principale
          <Input
            className="mt-1"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Téléphone public
          <Input
            className="mt-1"
            value={form.public_phone}
            onChange={(e) => setForm({ ...form, public_phone: e.target.value })}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Présentation
          <Textarea
            className="mt-1"
            rows={4}
            value={form.public_intro}
            onChange={(e) => setForm({ ...form, public_intro: e.target.value })}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Vitrine publiée</p>
          <p className="text-xs text-muted-foreground">
            Contrôle la visibilité de la fiche publique du chauffeur.
          </p>
        </div>
        <Switch
          checked={form.page_published}
          onCheckedChange={(v) => setForm({ ...form, page_published: v })}
          aria-label="Vitrine publiée"
        />
      </div>
      <Button className="mt-3 min-h-10" disabled={busy} onClick={() => void save()}>
        Enregistrer les modifications
      </Button>
    </Card>
  );
}

export function AdminDriverHoursCard({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const [week, setWeek] = useState<WorkingDay[]>(parseWorkingHours(null));
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "driver-hours", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_profiles")
        .select("working_hours")
        .eq("user_id", driverId)
        .maybeSingle();
      return data?.working_hours ?? null;
    },
  });

  useEffect(() => {
    setWeek(parseWorkingHours(data));
  }, [data]);

  function update(
    day: number,
    patch: { enabled?: boolean; start?: string; end?: string },
  ) {
    setWeek((prev) =>
      prev.map((d) => {
        if (d.day !== day) return d;
        if (typeof patch.enabled === "boolean") return { ...d, enabled: patch.enabled };
        return {
          ...d,
          slots: [{ start: patch.start ?? d.slots[0]?.start ?? "", end: patch.end ?? d.slots[0]?.end ?? "" }],
        };
      }),
    );
  }

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ working_hours: serializeWorkingHours(week) })
        .eq("user_id", driverId);
      if (error) throw error;
      await logAdminChange({
        targetUserId: driverId,
        action: "admin.hours_update",
        field: "working_hours",
        oldValue: data,
        newValue: serializeWorkingHours(week),
      });
      await qc.invalidateQueries();
      toast.success("Horaires mis à jour. Le badge de disponibilité est recalculé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Horaires de travail" icon={<Clock className="size-4 text-primary" />}>
      <ul className="space-y-2">
        {week.map((d) => (
          <li key={d.day} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            <Switch
              checked={d.enabled}
              onCheckedChange={(v) => update(d.day, { enabled: v })}
              aria-label={DAY_LABELS[d.day]}
            />
            <span className="w-24 text-sm font-medium">{DAY_LABELS[d.day]}</span>
            <Input
              type="time"
              className="w-32"
              disabled={!d.enabled}
              value={d.slots[0]?.start ?? ""}
              onChange={(e) => update(d.day, { start: e.target.value })}
            />
            <span className="text-sm text-muted-foreground">à</span>
            <Input
              type="time"
              className="w-32"
              disabled={!d.enabled}
              value={d.slots[0]?.end ?? ""}
              onChange={(e) => update(d.day, { end: e.target.value })}
            />
          </li>
        ))}
      </ul>
      <Button className="mt-3 min-h-10" disabled={busy} onClick={() => void save()}>
        Enregistrer les modifications
      </Button>
    </Card>
  );
}

export function AdminDriverTariffCard({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ price_per_km_ht: "", minimum_ht: "" });

  const { data } = useQuery({
    queryKey: ["admin", "driver-tariff", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_tariffs")
        .select("price_per_km_ht, minimum_ht")
        .eq("driver_id", driverId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data)
      setForm({
        price_per_km_ht: String(data.price_per_km_ht ?? ""),
        minimum_ht: String(data.minimum_ht ?? ""),
      });
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      const payload = {
        price_per_km_ht: Number(form.price_per_km_ht),
        minimum_ht: Number(form.minimum_ht),
      };
      if (!Number.isFinite(payload.price_per_km_ht) || payload.price_per_km_ht <= 0) {
        throw new Error("Tarif au kilomètre invalide");
      }
      if (!Number.isFinite(payload.minimum_ht) || payload.minimum_ht < 0) {
        throw new Error("Course minimum invalide");
      }
      const { error } = await supabase
        .from("driver_tariffs")
        .update(payload)
        .eq("driver_id", driverId);
      if (error) throw error;
      await logAdminChange({
        targetUserId: driverId,
        action: "admin.tariff_update",
        field: "driver_tariffs",
        oldValue: data,
        newValue: payload,
      });
      await qc.invalidateQueries();
      toast.success("Tarifs mis à jour. L'estimation utilise les nouvelles valeurs.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Tarifs" icon={<Euro className="size-4 text-primary" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Prix au kilomètre (HT)
          <Input
            className="mt-1"
            inputMode="decimal"
            value={form.price_per_km_ht}
            onChange={(e) => setForm({ ...form, price_per_km_ht: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Course minimum (HT)
          <Input
            className="mt-1"
            inputMode="decimal"
            value={form.minimum_ht}
            onChange={(e) => setForm({ ...form, minimum_ht: e.target.value })}
          />
        </label>
      </div>
      <Button className="mt-3 min-h-10" disabled={busy} onClick={() => void save()}>
        Enregistrer les modifications
      </Button>
    </Card>
  );
}
