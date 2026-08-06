import { createFileRoute } from "@tanstack/react-router";
import { QrPage } from "@/components/pro/QrPage";

export const Route = createFileRoute("/_authenticated/pro/qr")({
  component: QrPage,
});
