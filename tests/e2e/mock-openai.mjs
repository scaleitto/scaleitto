// A fake OpenAI Responses API for the end-to-end tests (background mode: create, then poll).
// The app is pointed at it with OPENAI_BASE_URL=http://127.0.0.1:4020/v1 and OPENAI_API_KEY=sk-test.
import { createServer } from "node:http";
import { pngBuffer } from "./helpers.mjs";

const jobs = new Map(); // id → { polls, body }
export const requests = [];
let counter = 0;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// The angles, as the strict rule asks: the merchant's chosen ones, or 5 required + 1 optional
function mockAngles(body, names) {
  const chosen = body.instructions?.match(/The merchant chose these angles: ([a-z, ]+)\./)?.[1]?.split(", ");
  const keys = chosen ?? ["problem", "solution", "benefits", "features", "objections", "offer"];
  return keys.map((key, i) => ({ key, required: chosen ? true : i < 5, name: names[i] ?? key, why: "سبب مختصر" }));
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
    strategy: { audience: "الشباب النشيطون", angles: mockAngles(body, ["الراحة اليومية", "القيمة مقابل السعر"]) },
    sections: [
      { type: "hero", title: "عنوان من الذكاء الاصطناعي", subtitle: "جملة قصيرة", image: images[0] ?? null, badge: null },
      { type: "badges", items: ["الدفع عند الاستلام", "توصيل 58 ولاية"] },
      { type: "imageText", title: "تفاصيل تفرق", body: "صورة قريبة تبين الجودة.", image: images[1] ?? null },
      { type: "benefits", title: "علاش تختارها", items: [{ icon: "droplet", title: "مقاومة للماء", text: "استعملها في كل يوم." }, { icon: "battery", title: "بطارية طويلة", text: "أيام بلا شحن." }] },
      { type: "features", title: null, items: ["ميزة أولى", "ميزة ثانية"] },
      { type: "image", url: "https://evil.example/not-allowed.png" },
      { type: "faq", title: null, items: [{ q: "كيف أطلب؟", a: "املأ الاستمارة." }] },
      { type: "cta", title: "اطلب الآن", subtitle: null },
    ],
  };
}

// Small tasks (call guide, customer messages, product description) answer by their schema name
const answers = {
  check: () => ({ ok: true }),
  // Image landing pages: the plan (texts, colors, one scene per section), as many sections as asked
  image_landing_page: (body) => {
    const text = body.input?.[0]?.content?.find((c) => c.type === "input_text")?.text ?? "";
    const n = Number(text.match(/Number of sections: (\d+)/)?.[1] ?? 6);
    const kinds = ["hero", "problem", "solution", "benefits", "features", "howto", "details", "beforeAfter", "offer", "cta"];
    return {
      title: "صفحة صور",
      product_name: text.includes("This is a new product") ? "مصباح ضد البعوض" : null,
      product_description: text.includes("This is a new product") ? "مصباح يقتل البعوض بهدوء." : null,
      palette: { background: "#0b1a3a", primary: "#2563eb", accent: "#facc15" },
      marquee: ["دفع عند التسليم", "توصيل سريع", "نتصل بك للتأكيد"],
      strategy: { audience: "العائلات", angles: mockAngles(body, ["نوم هادئ", "أمان العائلة", "سهولة الاستعمال"]) },
      sections: Array.from({ length: n }, (_, i) => ({ kind: i === n - 1 ? "offer" : kinds[i % 8], angle: i === 0 ? "نوم هادئ" : "سهولة الاستعمال", headline: `عنوان القسم ${i + 1}`, subtitle: i === 0 ? "نص فرعي قصير" : null, bullets: ["نقطة أولى", "نقطة ثانية"], cta: i === n - 1 ? "اطلب الآن" : null, scene: "A bedroom at night, product on a table" })),
    };
  },
  call_guide: () => ({
    pitch: "السلام عليكم، معاك المتجر. نعيطلك على الطلبية تاعك.",
    keyPoints: ["الدفع عند الاستلام", "توصيل لـ 58 ولاية"],
    questions: ["واش هو المقاس اللي يناسبك؟"],
    objections: [{ q: "السعر غالي", a: "الجودة تستاهل، وتخلص غير كي تستلم." }, { q: "واش نخلص قبل؟", a: "لا، الدفع عند الاستلام." }],
    closing: "نأكدو: المنتج، الكمية، المجموع والولاية. يعطيك الصحة!",
  }),
  customer_messages: () => ({
    confirm: "مرحبا {name}! طلبيتك {order} ({product}) بـ {total}. ابعث «نعم» للتأكيد. {unknown}",
    noAnswer: "مرحبا {name}، عيطنالك على الطلبية {order}. ابعث «نعم» للتأكيد.",
    unreachable: "مرحبا {name}، الهاتف خارج التغطية. أكد طلبيتك {order} بـ «نعم».",
    postponed: "مرحبا {name}، نعاودو نعيطولك على {order}.",
    shipped: "طلبيتك {order} خرجت، رقم التتبع {tracking}.",
    delivery: "الموصّل يعيطلك اليوم على {order}.",
  }),
  product_description: (body) => ({ description: `وصف من الذكاء الاصطناعي لـ ${body.input?.[0]?.content?.[0]?.text?.match(/Product name: (.*)/)?.[1] ?? "?"}\n• ميزة أولى\n• ميزة ثانية` }),
};

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
      // An image request (image_generation tool) gets a generated picture
      if (job.body.tools?.some((t) => t.type === "image_generation")) {
        return send(res, 200, { id: m[1], status: "completed", model: job.body.model, output: [{ type: "image_generation_call", status: "completed", result: pngBuffer([40, 160, 90], 96).toString("base64") }] });
      }
      const answer = (answers[job.body.text?.format?.name] ?? landingAnswer)(job.body);
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
