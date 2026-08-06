import { createFileRoute } from "@tanstack/react-router";
import { ProSettings } from "@/components/pro/ProSettings";

export const Route = createFileRoute("/_authenticated/pro/parametres")({
  component: ProSettings,
});
