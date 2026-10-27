// A fake OpenAI Responses API for the end-to-end tests (background mode: create, then poll).
// The app is pointed at it with OPENAI_BASE_URL=http://127.0.0.1:4020/v1 and OPENAI_API_KEY=sk-test.
import { createServer } from "node:http";

const jobs = new Map(); // id → { polls, body }
export const requests = [];
let counter = 0;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// What the "model" writes: a small landing page that follows the app's schema.
function landingAnswer(body) {
  const text = body.input?.[0]?.content?.find((c) => c.type === "input_text")?.text ?? "";
  const isNew = text.includes("This is a new product");
  const images = JSON.parse(text.match(/Product data \(JSON\):\n([\s\S]*?)\n\n/)?.[1] ?? "{}").images ?? [];
  return {
    title: "صفحة الذكاء الاصطناعي",
    product_name: isNew ? "ساعة ذكية AI" : null,
    product_description: isNew ? "وصف كتبه الذكاء الاصطناعي" : null,
    sections: [
      { type: "hero", title: "عنوان من الذكاء الاصطناعي", subtitle: "جملة قصيرة", image: images[0] ?? null, badge: null },
      { type: "badges", items: ["الدفع عند الاستلام", "توصيل 58 ولاية"] },
      { type: "features", title: null, items: ["ميزة أولى", "ميزة ثانية"] },
      { type: "image", url: "https://evil.example/not-allowed.png" },
      { type: "faq", title: null, items: [{ q: "كيف أطلب؟", a: "املأ الاستمارة." }] },
      { type: "cta", title: "اطلب الآن", subtitle: null },
    ],
  };
}

export function startMockOpenAi(port) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    if (req.headers.authorization !== "Bearer sk-test") return send(res, 401, { error: { message: "Incorrect API key" } });
    if (req.method === "GET" && path === "/v1/models") return send(res, 200, { data: [{ id: "gpt-6.1-sol" }, { id: "gpt-6.1-luna" }] });
    if (req.method === "POST" && path === "/v1/responses") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      requests.push(body);
      const id = `resp_${++counter}`;
      jobs.set(id, { polls: 0, body });
      return send(res, 200, { id, status: "queued", model: body.model });
    }
    const m = path.match(/^\/v1\/responses\/([\w-]+)$/);
    if (req.method === "GET" && m) {
      const job = jobs.get(m[1]);
      if (!job) return send(res, 404, { error: { message: "not found" } });
      // The first poll is still running, like a real background request
      if (job.polls++ === 0) return send(res, 200, { id: m[1], status: "in_progress" });
      const answer = job.body.text?.format?.name === "check" ? { ok: true } : landingAnswer(job.body);
      return send(res, 200, {
        id: m[1],
        status: "completed",
        model: job.body.model,
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(answer) }] }],
        usage: { input_tokens: 1200, output_tokens: 800 },
      });
    }
    send(res, 404, { error: { message: "unknown route" } });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
