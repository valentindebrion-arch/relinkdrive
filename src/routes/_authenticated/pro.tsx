import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Home,
  Car,
  Link2,
  SlidersHorizontal,
  UserRound,
  QrCode,
  ShieldCheck,
  Building2,
  HelpCircle,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";
import { ClientPageTransition } from "@/components/ClientPageTransition";
import { useAuth } from "@/lib/auth";
import { requireDriverAccess } from "@/lib/role-guard";
import { useDriverProfile } from "@/lib/driver-queries";
import { isDriverActive, isDriverSubmitted } from "@/lib/driver-dossier";

// Ordre réel des onglets de la barre inférieure chauffeur (index 0 = Ma vitrine).
const PRO_TAB_ORDER = ["/pro", "/pro/profil", "/pro/vehicule", "/pro/qr", "/pro/parametres"];
const PRO_TAB_KEYS = ["pro-home", "pro-profile", "pro-vehicles", "pro-qr", "pro-account"];

export const Route = createFileRoute("/_authenticated/pro")({
  beforeLoad: ({ location }) => requireDriverAccess(location.pathname),
  component: ProLayout,
});

function ProLayout() {
  const { isDriver, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const driver = useDriverProfile();

  useEffect(() => {
    if (!loading && !isDriver && !isAdmin) navigate({ to: "/espace", replace: true });
  }, [loading, isDriver, isAdmin, navigate]);

  const verified = isAdmin || isDriverActive(driver.data?.verification_status);
  // L'espace complet s'ouvre dès l'envoi du dossier ; la vitrine reste privée tant
  // que la vérification n'est pas terminée.
  const active = verified || isDriverSubmitted(driver.data?.verification_status);

  // Compte non validé : menu réduit au dossier et aux informations obligatoires.
  const restrictedItems: NavItem[] = [
    { to: "/pro/dossier", label: "Mon dossier", icon: <ShieldCheck /> },
    { to: "/pro/entreprise", label: "Mon entreprise", icon: <Building2 /> },
    { to: "/pro/vehicule", label: "Mes véhicules", icon: <Car /> },
    { to: "/pro/parametres", label: "Mon compte", icon: <UserRound /> },
    { to: "/aide", label: "Aide", icon: <HelpCircle /> },
  ];

  // Espace chauffeur : uniquement la gestion de la présence sur ReLink.
  const items: NavItem[] = [
    { to: "/pro", label: "Ma vitrine", icon: <Home /> },
    { to: "/pro/profil", label: "Mon profil", icon: <UserRound /> },
    { to: "/pro/vehicule", label: "Mes véhicules", icon: <Car /> },
    { to: "/pro/tarification", label: "Mes tarifs", icon: <SlidersHorizontal /> },
    { to: "/pro/liens", label: "Mes liens", icon: <Link2 /> },
    { to: "/pro/qr", label: "Mon QR code", icon: <QrCode /> },
    { to: "/pro/dossier", label: "Vérification", icon: <ShieldCheck /> },
    { to: "/pro/entreprise", label: "Mon entreprise", icon: <Building2 /> },
  ];

  const bottomItems: NavItem[] = [
    { to: "/pro", label: "Vitrine", icon: <Home /> },
    { to: "/pro/profil", label: "Profil", icon: <UserRound /> },
    { to: "/pro/vehicule", label: "Véhicules", icon: <Car /> },
    { to: "/pro/qr", label: "QR code", icon: <QrCode /> },
    { to: "/pro/parametres", label: "Compte", icon: <UserRound /> },
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
      settingsTo={active ? "/pro/parametres" : "/pro/parametres"}
      brandTo={active ? "/pro" : "/pro/dossier"}
    >
      <ClientPageTransition tabOrder={PRO_TAB_ORDER} tabKeys={PRO_TAB_KEYS} bottomOffset="5.5rem">
        <Outlet />
      </ClientPageTransition>
    </DashboardShell>
  );
}
