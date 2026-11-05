import { db } from "./db.js";

export function startRobuxSales() {
  const secret = process.env.ROBLOX_GROUP_SALES_COOKIE?.trim();
  if (!secret) return;
  const cookie = secret.startsWith(".ROBLOSECURITY=") ? secret : `.ROBLOSECURITY=${secret}`;
  if (/[;\r\n]/.test(cookie)) {
    console.warn("Set ROBLOX_GROUP_SALES_COOKIE to the Roblox session cookie only.");
    return;
  }

  async function poll() {
    let delay = 5000;
    try {
      const { data: orders, error } = await db().from("robux_checkout_orders")
        .select("order_token,group_id,pass_id,buyer_id,created_at")
        .is("sale_id", null).is("cancelled_at", null).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("created_at").limit(500);
      if (error) throw new Error("pending orders unavailable");
      const groups = new Map();
      for (const order of orders) {
        if (!groups.has(order.group_id)) groups.set(order.group_id, []);
        groups.get(order.group_id).push(order);
      }
      for (const [group, pending] of groups) {
        const sales = [];
        const earliest = Date.parse(pending[0].created_at);
        const url = new URL(`https://economy.roblox.com/v2/groups/${group}/transactions?transactionType=Sale&limit=100&sortOrder=Desc`);
        for (let page = 0; page < 10; page++) {
          const response = await fetch(url, { headers: { cookie }, redirect: "error", signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error(`Roblox group sales returned HTTP ${response.status}`);
          const result = await response.json();
          if (!Array.isArray(result.data)) throw new Error("Unexpected Roblox sales response");
          sales.push(...result.data);
          if (!result.nextPageCursor || result.data.some(sale => Date.parse(sale.created) < earliest)) break;
          url.searchParams.set("cursor", result.nextPageCursor);
        }
        for (const sale of sales.reverse()) {
          if (sale.agent?.type !== "User" || sale.details?.type !== "GamePass" || sale.currency?.type !== "Robux" || !(sale.currency.amount > 0)) continue;
          const saleId = sale.idHash || (Number.isSafeInteger(sale.id) ? String(sale.id) : sale.id);
          if (typeof saleId !== "string" || !saleId) continue;
          for (const order of pending) {
            if (order.sale_id || order.pass_id !== String(sale.details.id) || order.buyer_id !== String(sale.agent.id) || !(Date.parse(sale.created) >= Date.parse(order.created_at))) continue;
            const { data: claimed, error: claimError } = await db().rpc("claim_robux_sale", {
              p_order_token: order.order_token, p_group_id: group, p_sale_id: saleId,
              p_pass_id: order.pass_id, p_buyer_id: order.buyer_id, p_sold_at: sale.created,
            });
            if (claimError) throw new Error("Could not record Roblox sale");
            if (claimed) {
              order.sale_id = saleId;
              break;
            }
          }
        }
      }
    } catch (error) {
      delay = 60000;
      console.warn("Robux sales check failed:", error.message);
    } finally {
      setTimeout(poll, delay);
    }
  }
  void poll();
}
