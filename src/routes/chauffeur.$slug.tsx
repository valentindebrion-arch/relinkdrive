import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, Check, Languages, MapPin, Sparkles, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/storage";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chauffeur/$slug")({
  head: () => ({
    meta: [
      { title: `Fiche chauffeur — ${BRAND.name}` },
      {
        name: "description",
        content: "Ajoutez ce chauffeur à votre carnet privé de chauffeurs de confiance.",
      },
      { property: "og:title", content: `Fiche chauffeur — ${BRAND.name}` },
      { property: "og:description", content: "Ajoutez ce chauffeur à votre carnet de confiance." },
    ],
  }),
  component: DriverPublicPage,
});

function DriverPublicPage() {
  const { slug } = Route.useParams();
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const driverQuery = useQuery({
    queryKey: ["public-driver", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_driver_page", { _slug: slug });
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return {
        driver: {
          user_id: row.user_id,
          business_name: row.business_name,
          bio: row.bio,
          city: row.city,
          zone: row.zone,
          languages: row.languages,
          services: row.services,
        },
        profile: { full_name: row.full_name, avatar_url: row.avatar_url },
        vehicle: row.max_passengers
          ? {
              brand: row.vehicle_brand,
              model: row.vehicle_model,
              color: row.vehicle_color,
              photo_url: row.vehicle_photo_url,
              max_passengers: row.max_passengers,
              luggage_capacity: row.luggage_capacity,
              child_seat: row.child_seat,
              chargers: row.chargers,
              water: row.water,
              pets_allowed: row.pets_allowed,
              accessible: row.accessible,
            }
          : null,
      };
    },
  });


  const connQuery = useQuery({
    queryKey: ["conn", slug, user?.id],
    enabled: !!user?.id && !!driverQuery.data?.driver.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_client_connections")
        .select("id")
        .eq("client_id", user!.id)
        .eq("driver_id", driverQuery.data!.driver.user_id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (driverQuery.data?.driver.user_id) {
      void supabase.rpc("track_driver_page_view", { _slug: slug });
    }
  }, [driverQuery.data?.driver.user_id, slug]);

  const driverId = driverQuery.data?.driver.user_id;
  const driverCity = driverQuery.data?.driver.city ?? null;

  const connect = useCallback(async () => {
    if (!user?.id || !driverId) return;
    setAdding(true);
    const { error } = await supabase
      .from("driver_client_connections")
      .insert({ client_id: user.id, driver_id: driverId, source: "link" });
    setAdding(false);
    if (error) {
      if (error.code === "23505") {
        toast.success("Ce chauffeur est déjà dans votre carnet");
        void connQuery.refetch();
        return;
      }
      toast.error(error.message);
      return;
    }
    await supabase.from("analytics_events").insert({
      event: "driver_added",
      driver_id: driverId,
      client_id: user.id,
      city: driverCity,
    });
    await supabase.from("notifications").insert({
      user_id: driverId,
      title: "Nouveau client fidélisé",
      body: "Un client vient de vous ajouter à son carnet.",
      kind: "connection",
      link: "/pro/clients",
    });
    toast.success("Chauffeur ajouté à votre carnet");
    void connQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, driverId, driverCity]);

  // Ajout automatique après connexion / création de compte depuis ce lien
  useEffect(() => {
    if (!user?.id || !driverId || connQuery.isLoading || connQuery.data) return;
    if (sessionStorage.getItem("relink:pending-driver") !== slug) return;
    sessionStorage.removeItem("relink:pending-driver");
    void connect();
  }, [user?.id, driverId, connQuery.isLoading, connQuery.data, slug, connect]);

  const vehiclePhoto = useSignedUrl("vehicles", driverQuery.data?.vehicle?.photo_url).data;

  if (driverQuery.isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!driverQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">Page chauffeur indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce lien n'est pas valide, ou la page de ce chauffeur n'est pas encore publiée / validée par{" "}
            {BRAND.name}.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { driver, profile, vehicle } = driverQuery.data;
  const connected = !!connQuery.data;
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "Chauffeur";

  async function addDriver() {
    if (!session) {
      navigate({ to: "/auth", search: { mode: "signup", role: "client", next: `/chauffeur/${slug}` } });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("driver_client_connections").insert({
      client_id: user!.id,
      driver_id: driver.user_id,
      source: "link",
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("analytics_events").insert({
      event: "driver_added",
      driver_id: driver.user_id,
      client_id: user!.id,
      city: driver.city,
    });
    await supabase.from("notifications").insert({
      user_id: driver.user_id,
      title: "Nouveau client fidélisé",
      body: "Un client vient de vous ajouter à son carnet.",
      kind: "connection",
      link: "/pro/clients",
    });
    toast.success("Chauffeur ajouté à votre carnet");
    void connQuery.refetch();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="mb-4 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {BRAND.name}
      </p>
      <div className="surface overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border p-5">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={firstName} className="size-16 rounded-full object-cover" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-foreground">
              {firstName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{firstName}</h1>
            <p className="text-sm text-muted-foreground">{driver.business_name ?? "Chauffeur VTC indépendant"}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <Check className="size-3.5" /> Chauffeur vérifié
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {driver.bio ? <p className="text-muted-foreground">{driver.bio}</p> : null}

          {vehicle ? (
            <div>
              {vehiclePhoto ? (
                <img src={vehiclePhoto} alt="Véhicule" className="mb-3 h-40 w-full rounded-lg object-cover" />
              ) : null}
              <p className="flex items-center gap-2 font-medium">
                <Car className="size-4 text-primary" />
                {[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(" · ") || "Véhicule"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {vehicle.max_passengers} passagers · {vehicle.luggage_capacity} bagages
                {vehicle.child_seat ? " · siège enfant" : ""}
                {vehicle.chargers ? " · chargeurs" : ""}
                {vehicle.water ? " · eau" : ""}
                {vehicle.pets_allowed ? " · animaux acceptés" : ""}
                {vehicle.accessible ? " · accessible PMR" : ""}
              </p>
            </div>
          ) : null}

          {driver.languages?.length ? (
            <p className="flex items-center gap-2">
              <Languages className="size-4 text-primary" /> {driver.languages.join(", ")}
            </p>
          ) : null}
          {driver.services?.length ? (
            <p className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> {driver.services.join(", ")}
            </p>
          ) : null}
          {driver.zone || driver.city ? (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> {[driver.city, driver.zone].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border p-5">
          {connected ? (
            <>
              <p className="flex items-center gap-2 text-sm text-primary">
                <Check className="size-4" /> Ce chauffeur fait partie de votre carnet
              </p>
              <Button asChild className="w-full">
                <Link to="/espace/demandes" search={{ driver: driver.user_id }}>
                  Demander un trajet
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full" onClick={addDriver} disabled={adding}>
                <UserPlus className="size-4" /> Ajouter à mes chauffeurs
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Vous pourrez lui envoyer une demande de trajet une fois ajouté.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
