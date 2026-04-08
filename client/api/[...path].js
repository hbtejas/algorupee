/**
 * Vercel serverless proxy for frontend /api requests (client-root deployments).
 * Requires BACKEND_API_URL env var (e.g. https://your-backend.example.com).
 */

module.exports = async function handler(req, res) {
  const backendBase = String(process.env.BACKEND_API_URL || "").trim().replace(/\/$/, "");

  if (!backendBase) {
    res.status(500).json({
      error: "BACKEND_API_URL is not configured on Vercel",
      hint: "Set BACKEND_API_URL to your deployed backend origin",
    });
    return;
  }

  try {
    const incomingUrl = new URL(req.url, "http://localhost");
    const targetUrl = `${backendBase}${incomingUrl.pathname}${incomingUrl.search}`;

    const outgoingHeaders = {};
    for (const [key, value] of Object.entries(req.headers || {})) {
      const lower = String(key || "").toLowerCase();
      if (lower === "host" || lower === "content-length" || lower === "connection") {
        continue;
      }
      if (typeof value === "string") {
        outgoingHeaders[key] = value;
      }
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    const bodyAllowed = !["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase());
    let bodyBuffer;

    if (bodyAllowed) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      bodyBuffer = chunks.length ? Buffer.concat(chunks) : undefined;
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: outgoingHeaders,
      body: bodyBuffer,
    });

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      const lower = String(key || "").toLowerCase();
      if (lower === "transfer-encoding" || lower === "content-encoding") {
        return;
      }
      res.setHeader(key, value);
    });

    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    res.status(502).json({
      error: "Proxy request failed",
      details: error?.message || "Unknown proxy error",
    });
  }
};
