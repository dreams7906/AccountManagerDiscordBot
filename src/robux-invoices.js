import { db } from "./db.js";

export function startRobuxInvoices() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_EMAIL_TOKEN?.trim();
  if (!account || !token) return;

  async function sendDueInvoices() {
    const orders = db().from("robux_checkout_orders");
    const now = new Date().toISOString();
    try {
      const { data, error } = await orders.select("invoice_number,invoice_email,invoice_price,plan_id")
        .not("sale_id", "is", null).not("invoice_email", "is", null)
        .is("invoice_sent_at", null).lte("invoice_retry_at", now).order("invoice_retry_at").limit(10);
      if (error) throw new Error(`Invoice lookup failed (${error.code})`);
      for (const invoice of data) {
        const retryAt = new Date(Date.now() + 300000).toISOString();
        const { data: reserved, error: reserveError } = await orders.update({ invoice_retry_at: retryAt })
          .eq("invoice_number", invoice.invoice_number).is("invoice_sent_at", null)
          .lte("invoice_retry_at", now).select("invoice_number").maybeSingle();
        if (reserveError) throw new Error(`Invoice reservation failed (${reserveError.code})`);
        if (!reserved) continue;

        const plan = { week: "Weekly", month: "Monthly", lifetime: "Lifetime" }[invoice.plan_id] ?? invoice.plan_id;
        try {
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/email/sending/send`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              to: invoice.invoice_email,
              from: "utilities@shiftam.xyz",
              subject: `ShiftAM invoice · ${plan}`,
              text: [
                `ShiftAM invoice ${invoice.invoice_number}`,
                `Plan: ${plan}`,
                `Listed price: ${invoice.invoice_price} Robux`,
                "Payment: Confirmed by Roblox",
                "",
                "Get your key in the browser you used to check out: https://shiftam.xyz/thanks",
                "Sign in to your dashboard: https://shiftam.xyz/account",
                "Join our Discord community for purchase support: https://discord.gg/uMyVQHXRFv",
              ].join("\n"),
            }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.success || !(result.result?.queued?.length || result.result?.delivered?.length)) {
            throw new Error(`Cloudflare did not accept the invoice (HTTP ${response.status})`);
          }
          const { error: updateError } = await orders.update({ invoice_sent_at: new Date().toISOString() })
            .eq("invoice_number", invoice.invoice_number).eq("invoice_retry_at", retryAt);
          if (updateError) throw new Error(`Invoice status update failed (${updateError.code})`);
        } catch (sendError) {
          console.warn("Robux invoice will retry:", sendError.message);
        }
      }
    } catch (error) {
      console.warn("Robux invoice check failed:", error.message);
    } finally {
      setTimeout(sendDueInvoices, 10000);
    }
  }
  void sendDueInvoices();
}
