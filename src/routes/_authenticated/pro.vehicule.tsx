import { createFileRoute } from "@tanstack/react-router";
import { VehiclePage } from "@/components/pro/VehiclePage";

export const Route = createFileRoute("/_authenticated/pro/vehicule")({
  component: VehiclePage,
});
