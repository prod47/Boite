// Runs daily (scheduled via Supabase Cron). For every active purchase that just crossed the
// J-7 or J-2 threshold, sends a real Web Push notification to that purchase owner's registered
// devices — this is what lets an alert arrive even when the app hasn't been opened in days.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:retours-app@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00").getTime();
  const b = new Date(toISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("id, user_id, store, deadline, alert_d7_sent, alert_d2_sent, items(refunded)");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;

  for (const p of purchases ?? []) {
    const items = (p.items ?? []) as { refunded: boolean }[];
    const stillActive = items.some((it) => !it.refunded);
    if (!stillActive) continue;

    const daysLeft = daysBetween(today, p.deadline);
    if (daysLeft < 0) continue;

    const threshold = daysLeft <= 2 && !p.alert_d2_sent ? 2 : daysLeft <= 7 && !p.alert_d7_sent ? 7 : null;
    if (threshold === null) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", p.user_id);

    const payload = JSON.stringify({
      title: "⏰ Retour à faire bientôt",
      body: `${p.store || "Un achat"} — il reste ${daysLeft} jour(s) pour le retourner.`,
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired/revoked on the device side — stop retrying it.
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }

    const field = threshold === 2 ? "alert_d2_sent" : "alert_d7_sent";
    await supabase.from("purchases").update({ [field]: true }).eq("id", p.id);
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
