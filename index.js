const TELEGRAM_API = "https://api.telegram.org";

async function telegram(env, method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data;
}

async function sendMessage(env, chatId, text) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.BOT_TOKEN) {
      return new Response("BOT_TOKEN secret is missing", { status: 500 });
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "ARIA CHECK BOT",
        version: "v1",
      });
    }

    // One-time webhook setup. Open /setup once after deployment.
    if (request.method === "GET" && url.pathname === "/setup") {
      const webhookUrl = `${url.origin}/webhook`;

      const result = await telegram(env, "setWebhook", {
        url: webhookUrl,
        drop_pending_updates: true,
      });

      return Response.json({
        ok: true,
        webhook: webhookUrl,
        telegram: result,
      });
    }

    // Telegram webhook
    if (request.method === "POST" && url.pathname === "/webhook") {
      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("Bad Request", { status: 400 });
      }

      const message = update?.message;
      if (!message?.chat?.id) {
        return new Response("OK");
      }

      const chatId = message.chat.id;
      const text = String(message.text || "").trim();

      if (text === "/start" || text.startsWith("/start@")) {
        await sendMessage(
          env,
          chatId,
          "✅ ربات حسابداری آریا فعال شد.\n\nنسخه آزمایشی V1"
        );
      } else {
        await sendMessage(
          env,
          chatId,
          "فعلاً فقط دستور /start فعال است."
        );
      }

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
};
