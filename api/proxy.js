/**
 * Vercel serverless proxy for frontend /api requests.
 * Forwards requests to the backend service defined in BACKEND_API_URL.
 */

module.exports = async function handler(req, res) {
  // Use configured backend, with safe production fallback for misconfigured deployments.
  const backendBase = String(process.env.BACKEND_API_URL || process.env.DEFAULT_BACKEND_API_URL || "https://algorupee-backend.onrender.com")
    .trim()
    .replace(/\/$/, "");

  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // 8. Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Handle missing backend target
  if (!backendBase) {
    res.writeHead(503, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ error: "Backend unavailable", code: 503, hint: "Set BACKEND_API_URL in Vercel project settings" }));
    return;
  }

  try {
    const incomingUrl = new URL(req.url, "http://localhost");
    const rawPath = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
    const normalizedPath = String(rawPath || "").replace(/^\/+/, "");

    const forwardedQuery = new URLSearchParams(incomingUrl.searchParams);
    forwardedQuery.delete("path");

    const qs = forwardedQuery.toString();
    const targetPath = normalizedPath ? `/api/${normalizedPath}` : "/api";
    const targetUrl = `${backendBase}${targetPath}${qs ? `?${qs}` : ""}`;

    // 3. Copy headers except 'host'
    const outgoingHeaders = {};
    for (const [key, value] of Object.entries(req.headers || {})) {
      if (key.toLowerCase() !== "host") {
        outgoingHeaders[key] = value;
      }
    }

    // 4. Forward body for POST/PUT/PATCH
    const bodyAllowed = ["POST", "PUT", "PATCH"].includes(req.method.toUpperCase());
    let body;
    if (bodyAllowed) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    // 5. Use native Node 18 fetch
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: outgoingHeaders,
      body: body,
      redirect: "manual",
    });

    // 5. Stream backend response back
    const responseHeaders = { ...corsHeaders };
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      // Skip potentially problematic headers for proxying
      if (k !== "transfer-encoding" && k !== "content-encoding" && k !== "access-control-allow-origin") {
        responseHeaders[key] = value;
      }
    });

    res.writeHead(upstream.status, responseHeaders);
    const arrayBuffer = await upstream.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    // Upstream unavailable
    res.writeHead(503, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ error: "Backend unavailable", code: 503, details: error?.message || "Proxy request failed" }));
  }
};
