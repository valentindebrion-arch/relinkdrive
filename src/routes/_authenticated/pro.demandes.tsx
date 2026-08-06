import { createFileRoute } from "@tanstack/react-router";
import { DriverRequests } from "@/components/pro/DriverRequests";

export const Route = createFileRoute("/_authenticated/pro/demandes")({
  component: DriverRequests,
});
