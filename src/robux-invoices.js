import { db } from "./db.js";
import { renderEmail } from "./email-template.js";

export function startRobuxInvoices() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_EMAIL_TOKEN?.trim();
  if (!account || !token) return;

  async function sendInvoices(paid) {
    const orders = db().from("robux_checkout_orders");
    const now = new Date().toISOString();
    const sentColumn = paid ? "invoice_sent_at" : "pending_invoice_sent_at";
    const retryColumn = paid ? "invoice_retry_at" : "pending_invoice_retry_at";
    try {
      const due = orders.select("invoice_number,invoice_email,invoice_price,plan_id,expires_at,order_token")
        .not("invoice_email", "is", null).is("cancelled_at", null)
        .is(sentColumn, null).lte(retryColumn, now).order(retryColumn).limit(10);
      const { data, error } = await (paid ? due.not("sale_id", "is", null) : due.is("sale_id", null).gt("expires_at", now));
      if (error) throw new Error(`Invoice lookup failed (${error.code})`);
      for (const invoice of data) {
        const retryAt = new Date(Date.now() + 300000).toISOString();
        const reserve = orders.update({ [retryColumn]: retryAt })
          .eq("invoice_number", invoice.invoice_number).is("cancelled_at", null).is(sentColumn, null).lte(retryColumn, now);
        const { data: reserved, error: reserveError } = await (paid ? reserve.not("sale_id", "is", null)
          : reserve.is("sale_id", null).gt("expires_at", now)).select("invoice_number").maybeSingle();
        if (reserveError) throw new Error(`Invoice reservation failed (${reserveError.code})`);
        if (!reserved) continue;

        const plan = { week: "Weekly", month: "Monthly", lifetime: "Lifetime" }[invoice.plan_id] ?? invoice.plan_id;
        const fmt = (d) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }).format(d) + " PT";
        const invoiceUrl = `https://shiftam.xyz/thanks?invoice=${encodeURIComponent(invoice.invoice_number)}`;
        // The key is made in the same step that records the sale, so a paid receipt can carry it.
        let licenseKey;
        if (paid) {
          const { data: keyRow } = await db().from("license_keys").select("key").eq("order_token", invoice.order_token).maybeSingle();
          licenseKey = keyRow?.key ?? undefined;
        }
        const email = renderEmail(paid ? {
          preheader: licenseKey ? `Your ShiftAM ${plan} key is inside.` : `Your ShiftAM ${plan} payment went through.`,
          status: { label: "Payment received", tone: "ok" },
          title: "Thanks for your purchase!",
          intro: `We got your Robux payment for ShiftAM ${plan}.${licenseKey ? " Your key is below." : " Your key is on your order page."}`,
          rows: [["Plan", `ShiftAM ${plan}`], ["Payment method", "Robux (game pass)"], ["Invoice", invoice.invoice_number], ["Paid", fmt(new Date())]],
          total: ["Total paid", `${invoice.invoice_price} Robux`],
          licenseKey,
          button: licenseKey ? { label: "Create your account", href: `https://shiftam.xyz/register?key=${encodeURIComponent(licenseKey)}` } : { label: "Open your order", href: invoiceUrl },
          note: "Already have an account? Sign in and redeem the key on your dashboard. Keep this email: it is your receipt.",
        } : {
          preheader: `Pay ${invoice.invoice_price} Robux before ${fmt(new Date(invoice.expires_at))} to get your key.`,
          status: { label: "Awaiting payment", tone: "pending" },
          title: "Your ShiftAM invoice",
          intro: `Buy the game pass on Roblox from the account you chose at checkout. Your key appears as soon as the payment goes through.`,
          rows: [["Plan", `ShiftAM ${plan}`], ["Payment method", "Robux (game pass)"], ["Invoice", invoice.invoice_number], ["Pay before", fmt(new Date(invoice.expires_at))]],
          total: ["Amount due", `${invoice.invoice_price} Robux`],
          button: { label: "Open your invoice", href: invoiceUrl },
          note: "Open the invoice in the browser you checked out with. Unpaid invoices expire at the time above.",
        });
        try {
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/email/sending/send`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              to: invoice.invoice_email,
              from: { address: "utilities@shiftam.xyz", name: "ShiftAM" },
              subject: paid ? `Your ShiftAM ${plan} receipt${licenseKey ? " and key" : ""}` : `Your ShiftAM invoice · ${invoice.invoice_price} Robux`,
              text: email.text,
              html: email.html,
            }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.success || !(result.result?.queued?.length || result.result?.delivered?.length)) {
            throw new Error(`Cloudflare did not accept the invoice (HTTP ${response.status})`);
          }
          const { error: updateError } = await orders.update({ [sentColumn]: new Date().toISOString() })
            .eq("invoice_number", invoice.invoice_number).eq(retryColumn, retryAt);
          if (updateError) throw new Error(`Invoice status update failed (${updateError.code})`);
        } catch (sendError) {
          console.warn("Robux invoice will retry:", sendError.message);
        }
      }
    } catch (error) {
      console.warn("Robux invoice check failed:", error.message);
    }
  }
  async function poll() {
    try {
      await Promise.all([sendInvoices(false), sendInvoices(true)]);
    } finally {
      setTimeout(poll, 10000);
    }
  }
  void poll();
}
