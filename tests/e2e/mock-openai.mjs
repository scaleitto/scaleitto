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

// Small tasks (product description) answer by their schema name
const answers = {
  check: () => ({ ok: true }),
  // "Generate with AI": the plan (one short text and scene per image), as many images as asked
  image_landing_page: (body) => {
    const text = body.input?.[0]?.content?.find((c) => c.type === "input_text")?.text ?? "";
    const n = Number(text.match(/Number of images: (\d+)/)?.[1] ?? 4);
    return {
      title: "صفحة صور",
      product_name: null,
      product_description: null,
      images: Array.from({ length: n }, (_, i) => ({ headline: `عنوان الصورة ${i + 1}`, subtitle: i === 0 ? "نص فرعي قصير" : null, bullets: ["نقطة أولى", "نقطة ثانية"], scene: "A bedroom at night, product on a table" })),
    };
  },
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
      const answer = (answers[job.body.text?.format?.name] ?? answers.check)(job.body);
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
