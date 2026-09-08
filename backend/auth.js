const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.SESSION_SECRET || "surat-kemenag-secret-key-2026-production";
const COOKIE_NAME = "auth_token";
const CSRF_COOKIE_NAME = "csrf_token";

/**
 * Buat JWT token dari data user
 * @param {object} user 
 * @returns {string} token
 */
function signToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branchId: user.branchId || null,
    branchName: user.branchName || null,
    signatoryId: user.signatoryId || null,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

/**
 * Verifikasi JWT token
 * @param {string} token 
 * @returns {object|null}
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware untuk mem-parsing token dari cookie atau Authorization Header
 * Menempelkan req.user dan kompatibilitas req.session.user
 */
function authenticateUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.session = { user: decoded };
      return next();
    }
  }

  req.user = null;
  req.session = { user: null };
  next();
}

/**
 * Generate CSRF token menggunakan pola Double-Submit Cookie (Stateless & Serverless Friendly)
 */
function getOrGenerateCsrfToken(req, res) {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    const isSecure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Boleh dibaca client untuk X-CSRF-Token
      secure: isSecure,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
    });
  }
  return token;
}

/**
 * Verifikasi CSRF token pada metode mutasi data
 */
function verifyCsrfToken(req, res, next) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Kecualikan endpoint login, auth, dan webhook
  if (req.path === "/api/login" || req.path.startsWith("/auth") || req.path.startsWith("/oauth2callback")) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const clientToken = req.headers["x-csrf-token"] || req.headers["x-xsrf-token"] || req.body?._csrf;

  if (!cookieToken || !clientToken || cookieToken !== clientToken) {
    return res.status(403).json({
      error: "Permintaan ditolak: Token CSRF tidak valid atau telah kedaluwarsa. Silakan muat ulang halaman.",
      code: "INVALID_CSRF_TOKEN",
    });
  }

  next();
}

// ---------- RBAC Middlewares ----------
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Belum login" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    return res.status(403).json({ error: "Hanya Admin Operator / Superadmin yang berwenang" });
  }
  next();
}

function requireKepalaBidang(req, res, next) {
  if (!req.user || (req.user.role !== "kepala_bidang" && req.user.role !== "superadmin")) {
    return res.status(403).json({ error: "Hanya Kepala Bidang (Pejabat Penandatangan) / Superadmin yang berwenang" });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Hanya Super Administrator yang berwenang" });
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  CSRF_COOKIE_NAME,
  signToken,
  verifyToken,
  authenticateUser,
  getOrGenerateCsrfToken,
  verifyCsrfToken,
  requireAuth,
  requireAdmin,
  requireKepalaBidang,
  requireSuperAdmin,
};

