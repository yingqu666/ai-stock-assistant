const buckets = new Map();

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
}

export function rateLimit({ windowMs = 60_000, max = 120 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      res.status(429).json({ ok: false, message: "请求过于频繁，请稍后再试" });
      return;
    }

    next();
  };
}

export function notFound(_req, res) {
  res.status(404).json({ ok: false, message: "接口不存在" });
}

export function errorHandler(error, _req, res, _next) {
  console.error("[api-error]", {
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    time: new Date().toISOString(),
  });
  res.status(error.statusCode ?? 500).json({
    ok: false,
    message: process.env.NODE_ENV === "production" ? "服务器错误" : error.message,
  });
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
