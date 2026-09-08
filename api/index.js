let app;
let initError = null;

try {
  app = require("../backend/server");
} catch (err) {
  initError = err;
  console.error("❌ [FATAL API STARTUP ERROR]:", err);
}

module.exports = (req, res) => {
  if (initError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      error: "Gagal menginisialisasi backend di Vercel",
      message: initError.message,
      code: initError.code || "MODULE_INIT_FAILED",
      stack: initError.stack
    }, null, 2));
  }

  return app(req, res);
};
