import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

type Body = { notification_id?: string };

export const Route = createFileRoute("/api/public/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_HOOK_SECRET"];
        if (!secret || request.headers.get("x-push-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!body.notification_id) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notification } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, body, link, kind, created_at")
          .eq("id", body.notification_id)
          .maybeSingle();
        if (!notification) return new Response("Not found", { status: 404 });

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", notification.user_id);
        if (!subs?.length) return Response.json({ sent: 0 });

        const vapid = {
          subject: process.env["VAPID_SUBJECT"] ?? "mailto:contact@relink.app",
          publicKey: process.env["VAPID_PUBLIC_KEY"]!,
          privateKey: process.env["VAPID_PRIVATE_KEY"]!,
        };

        const message = {
          data: JSON.stringify({
            title: notification.title,
            body: notification.body ?? "",
            link: notification.link ?? "/espace",
            id: notification.id,
            tag: notification.id,
            at: notification.created_at,
          }),
          // TTL long + urgence haute : le message réveille l'appareil verrouillé
          // et reste en file d'attente si le téléphone est hors ligne.
          options: { ttl: 86400, urgency: "high" as const },
        };

        console.log(`[push] notification ${notification.id} → ${subs.length} appareil(s)`);

        let sent = 0;
        await Promise.all(
          subs.map(async (s) => {
            const subscription: PushSubscription = {
              endpoint: s.endpoint,
              expirationTime: null,
              keys: { p256dh: s.p256dh, auth: s.auth },
            };
            try {
              const payload = await buildPushPayload(message, subscription, vapid);
              const res = await fetch(s.endpoint, payload as unknown as RequestInit);
              if (res.status === 404 || res.status === 410) {
                console.warn(`[push] abonnement expiré (${res.status}), suppression`);
                await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
              } else if (res.ok) {
                sent += 1;
                console.log(`[push] envoyé (${res.status})`);
              } else {
                console.error(`[push] refus fournisseur ${res.status} ${await res.text()}`);
              }
            } catch (error) {
              console.error("[push] send failed", error);
            }
          }),
        );

        console.log(`[push] notification ${notification.id} : ${sent}/${subs.length} envoyée(s)`);
        return Response.json({ sent, total: subs.length });
      },
    },
  },
});
