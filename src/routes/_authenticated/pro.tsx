import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Home,
  Car,
  Users,
  Receipt,
  Bot,
  UserRound,
  CalendarDays,
  ShieldCheck,
  Building2,
  HelpCircle,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { ClientPageTransition } from "@/components/ClientPageTransition";
import { useAuth } from "@/lib/auth";
import { requireDriverAccess } from "@/lib/role-guard";
import { useNewRequestsCount, useDriverProfile } from "@/lib/driver-queries";
import { isDriverActive } from "@/lib/driver-dossier";
import { useMyPlan } from "@/lib/plan";
import { ProUpsell } from "@/components/pro/ProUpsell";

// Ordre réel des onglets de la barre inférieure chauffeur (index 0 = Accueil).
const PRO_TAB_ORDER = ["/pro", "/pro/courses", "/pro/clients", "/pro/planning", "/pro/profil"];
const PRO_TAB_KEYS = ["pro-home", "pro-rides", "pro-clients", "pro-planning", "pro-profile"];

export const Route = createFileRoute("/_authenticated/pro")({
  beforeLoad: ({ location }) => requireDriverAccess(location.pathname),
  component: ProLayout,
});

function ProLayout() {
  const { isDriver, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const newRequests = useNewRequestsCount();
  const driver = useDriverProfile();
  const { isPro } = useMyPlan();
  const { pathname } = useLocation();
  const proOnlyPath = ["/pro/planning", "/pro/clients", "/pro/assistant", "/pro/disponibilites"].some(
    (p) => pathname.startsWith(p),
  );

  useEffect(() => {
    if (!loading && !isDriver && !isAdmin) navigate({ to: "/espace", replace: true });
  }, [loading, isDriver, isAdmin, navigate]);

  const active = isAdmin || isDriverActive(driver.data?.verification_status);
  const badge = active ? newRequests.data || undefined : undefined;

  // Compte non validé : menu réduit au dossier et aux informations obligatoires.
  const restrictedItems: NavItem[] = [
    { to: "/pro/dossier", label: "Mon dossier", icon: <ShieldCheck /> },
    { to: "/pro/entreprise", label: "Mon entreprise", icon: <Building2 /> },
    { to: "/pro/vehicule", label: "Mon véhicule", icon: <Car /> },
    { to: "/pro/parametres", label: "Mon compte", icon: <UserRound /> },
    { to: "/aide", label: "Aide", icon: <HelpCircle /> },
  ];

  // Les outils professionnels (planning, clientèle, assistant) sont réservés
  // à l'offre ReLink Pro ; l'offre Gratuite conserve les Courses Flash.
  const items: NavItem[] = [
    { to: "/pro", label: "Accueil", icon: <Home /> },
    { to: "/pro/courses", label: "Mes courses", icon: <Car />, badge },
    ...(isPro
      ? [
          { to: "/pro/planning", label: "Planning", icon: <CalendarDays /> },
          { to: "/pro/clients", label: "Mes clients", icon: <Users /> },
        ]
      : []),
    { to: "/pro/factures", label: "Facturation", icon: <Receipt /> },
    ...(isPro ? [{ to: "/pro/assistant", label: "Assistant", icon: <Bot /> }] : []),
    { to: "/pro/profil", label: "Mon profil", icon: <UserRound /> },
  ];

  const bottomItems: NavItem[] = isPro
    ? [
        { to: "/pro", label: "Accueil", icon: <Home /> },
        { to: "/pro/courses", label: "Courses", icon: <Car />, badge },
        { to: "/pro/clients", label: "Clients", icon: <Users /> },
        { to: "/pro/planning", label: "Planning", icon: <CalendarDays /> },
        { to: "/pro/profil", label: "Profil", icon: <UserRound /> },
      ]
    : [
        { to: "/pro", label: "Accueil", icon: <Home /> },
        { to: "/pro/courses", label: "Courses", icon: <Car />, badge },
        { to: "/pro/factures", label: "Factures", icon: <Receipt /> },
        { to: "/pro/profil", label: "Profil", icon: <UserRound /> },
      ];

  const restrictedBottom: NavItem[] = [
    { to: "/pro/dossier", label: "Dossier", icon: <ShieldCheck /> },
    { to: "/pro/entreprise", label: "Entreprise", icon: <Building2 /> },
    { to: "/pro/vehicule", label: "Véhicule", icon: <Car /> },
    { to: "/pro/parametres", label: "Compte", icon: <UserRound /> },
  ];

  return (
    <DashboardShell
      items={active ? items : restrictedItems}
      bottomItems={active ? bottomItems : restrictedBottom}
      area="Espace chauffeur"
      settingsTo={active ? "/pro/profil" : "/pro/parametres"}
      brandTo={active ? "/pro" : "/pro/dossier"}
    >
      <ClientPageTransition tabOrder={PRO_TAB_ORDER} tabKeys={PRO_TAB_KEYS} bottomOffset="5.5rem">
        {!isPro && proOnlyPath ? <ProUpsell /> : <Outlet />}
      </ClientPageTransition>
    </DashboardShell>
  );
}
