import { db } from "./db.js";

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
      const due = orders.select("invoice_number,invoice_email,invoice_price,plan_id,expires_at")
        .not("invoice_email", "is", null)
        .is(sentColumn, null).lte(retryColumn, now).order(retryColumn).limit(10);
      const { data, error } = await (paid ? due.not("sale_id", "is", null) : due.is("sale_id", null).gt("expires_at", now));
      if (error) throw new Error(`Invoice lookup failed (${error.code})`);
      for (const invoice of data) {
        const retryAt = new Date(Date.now() + 300000).toISOString();
        const reserve = orders.update({ [retryColumn]: retryAt })
          .eq("invoice_number", invoice.invoice_number).is(sentColumn, null).lte(retryColumn, now);
        const { data: reserved, error: reserveError } = await (paid ? reserve.not("sale_id", "is", null)
          : reserve.is("sale_id", null).gt("expires_at", now)).select("invoice_number").maybeSingle();
        if (reserveError) throw new Error(`Invoice reservation failed (${reserveError.code})`);
        if (!reserved) continue;

        const plan = { week: "Weekly", month: "Monthly", lifetime: "Lifetime" }[invoice.plan_id] ?? invoice.plan_id;
        const label = paid ? "Payment confirmed" : "Awaiting payment";
        const deadline = paid ? "" : new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles",
        }).format(new Date(invoice.expires_at)) + " Pacific time";
        const invoiceUrl = `https://shiftam.xyz/thanks?invoice=${encodeURIComponent(invoice.invoice_number)}`;
        const escapedPlan = String(plan).replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
        try {
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/email/sending/send`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              to: invoice.invoice_email,
              from: "utilities@shiftam.xyz",
              subject: `ShiftAM ${paid ? "payment receipt" : "unpaid invoice"} · ${plan}`,
              text: [
                `ShiftAM invoice ${invoice.invoice_number}`,
                `Plan: ${plan}`,
                `Listed price: ${invoice.invoice_price} Robux`,
                label,
                ...(!paid ? [
                  `Pay before: ${deadline}`,
                ] : []),
                "",
                `Open your saved invoice in the browser you used to check out: ${invoiceUrl}`,
                "Sign in to your dashboard: https://shiftam.xyz/account",
                "Join our Discord community for purchase support: https://discord.gg/uMyVQHXRFv",
              ].join("\n"),
              html: `<div style="max-width:560px;margin:0 auto;font:16px Arial,sans-serif;color:#17152c">
                <div style="padding:24px;background:#241748;color:#fff;border-radius:14px 14px 0 0">
                  <strong>ShiftAM</strong><h1 style="margin:8px 0 0;font-size:25px">${paid ? "Payment receipt" : "Your invoice"}</h1>
                </div>
                <div style="padding:24px;border:1px solid #e4def0;border-radius:0 0 14px 14px">
                  <p style="margin-top:0;color:#6443a8"><strong>${label}</strong></p>
                  <p><strong>${escapedPlan}</strong> · ${invoice.invoice_price} Robux (listed price)</p>
                  <p style="font-size:13px;overflow-wrap:anywhere">Invoice ${invoice.invoice_number}</p>
                  ${deadline ? `<p>Pay before <strong>${deadline}</strong>.</p>` : ""}
                  <p><a href="${invoiceUrl}" style="display:inline-block;padding:12px 18px;background:#5b36ac;color:#fff;text-decoration:none;border-radius:8px">Open saved invoice</a></p>
                  <p style="font-size:14px">Use the browser you checked out with to open this invoice.</p>
                  <p style="font-size:14px"><a href="https://shiftam.xyz/account">Dashboard</a> · <a href="https://discord.gg/uMyVQHXRFv">Discord support</a></p>
                </div>
              </div>`,
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
