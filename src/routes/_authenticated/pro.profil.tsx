import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/Ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProSettings } from "@/components/pro/ProSettings";
import { CompanyPage } from "@/components/pro/CompanyPage";
import { VehiclePage } from "@/components/pro/VehiclePage";
import { VerificationPage } from "@/components/pro/VerificationPage";
import { QrPage } from "@/components/pro/QrPage";

export const Route = createFileRoute("/_authenticated/pro/profil")({
  component: ProProfileHub,
});

function ProProfileHub() {
  const [tab, setTab] = useState("compte");

  return (
    <>
      <PageHeader title="Mon profil" description="Compte, entreprise, véhicule, vérification et page publique." />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="compte">Compte</TabsTrigger>
            <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
            <TabsTrigger value="vehicule">Véhicule</TabsTrigger>
            <TabsTrigger value="verification">Vérification</TabsTrigger>
            <TabsTrigger value="qr">Page publique & QR</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="compte">
          <ProSettings />
        </TabsContent>
        <TabsContent value="entreprise">
          <CompanyPage />
        </TabsContent>
        <TabsContent value="vehicule">
          <VehiclePage />
        </TabsContent>
        <TabsContent value="verification">
          <VerificationPage />
        </TabsContent>
        <TabsContent value="qr">
          <QrPage />
        </TabsContent>
      </Tabs>
    </>
  );
}
