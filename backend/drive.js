const fs = require("fs");
const path = require("path");
const os = require("os");
const { google } = require("googleapis");

const CONFIG_PATH = path.join(__dirname, "drive-config.json");
const TMP_CONFIG_PATH = path.join(os.tmpdir(), "drive-config.json");
const SA_PATH = path.join(__dirname, "service-account.json");

/**
 * Membaca konfigurasi drive-config.json (dari env, tmp, atau file lokal)
 */
function getDriveConfig() {
  // Prioritas 1: Dari Environment Variables (Sangat stabil untuk Vercel Serverless)
  const envRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  if (envRefreshToken) {
    return {
      folderId: getFolderId(),
      refreshToken: envRefreshToken,
      tokens: {
        refresh_token: envRefreshToken,
      },
    };
  }

  // Prioritas 2: Dari /tmp (jika baru login OAuth di Vercel)
  if (fs.existsSync(TMP_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(TMP_CONFIG_PATH, "utf-8"));
    } catch {}
  }

  // Prioritas 3: Dari file lokal drive-config.json
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Mendapatkan ID Folder Google Drive dari file konfigurasi atau env
 */
function getFolderId() {
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return process.env.GOOGLE_DRIVE_FOLDER_ID;
  }
  const config = getDriveConfig();
  return config.folderId || null;
}

/**
 * Mendapatkan ID Folder khusus Draft surat di Google Drive
 */
function getDraftFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_DRAFT_ID || 
         process.env.GOOGLE_DRIVE_DRAFT_FOLDER_ID || 
         '1XCM0iYYbVY_Dyilz4xBvscVTKlNT9Mxw';
}

/**
 * Mendapatkan ID Folder khusus Surat Resmi (Sudah TTD) di Google Drive
 */
function getSignedFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_SIGNED_ID || 
         process.env.GOOGLE_DRIVE_FOLDER_ID || 
         getFolderId() ||
         '15eoUcYIaYiUYmaqzZXCm4oQRC6cBgeHO';
}

function shouldRefreshDriveToken(token) {
  if (!token) return true;
  if (typeof token.expiry_date !== "number") return true;
  return token.expiry_date <= Date.now() + 60 * 1000;
}

function sanitizeDriveCredentials(credentials = {}) {
  const next = { ...credentials };

  if (next.refreshToken && !next.refresh_token) {
    next.refresh_token = next.refreshToken;
  }

  const refreshToken = next.refresh_token || next.refreshToken;
  if (refreshToken && shouldRefreshDriveToken(next)) {
    delete next.access_token;
  }

  delete next.refreshToken;
  return next;
}

/**
 * Mendapatkan instance OAuth2 Client
 * Mendukung Environment Variables (Vercel) dan file lokal (Development)
 */
function getOAuth2Client(req) {
  // 1. Cek Environment Variables (Vercel Production)
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  let redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!redirectUri && req) {
    const host = req.get("host");
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    redirectUri = `${protocol}://${host}/oauth2callback`;
  }
  if (!redirectUri) {
    redirectUri = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/oauth2callback`
      : "http://localhost:3000/oauth2callback";
  }

  if (clientId && clientSecret) {
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  // 2. Cek apakah ada file kredensial lokal
  const possiblePaths = [
    path.join(__dirname, "oauth.json"),
    path.join(__dirname, "service-account.json.json"),
    path.join(__dirname, "client_secret.json"),
    path.join(__dirname, "credentials.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
        const web = parsed.web || parsed.installed;
        if (web && web.client_id) {
          const { client_id, client_secret, redirect_uris } = web;
          const uri = redirectUri || (redirect_uris && redirect_uris[0]) || "http://localhost:3000/oauth2callback";
          return new google.auth.OAuth2(client_id, client_secret, uri);
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Membuat instance client Google Drive API
 */
function getDriveClient() {
  const config = getDriveConfig();
  const oauth2Client = getOAuth2Client();

  // Prioritas 1: OAuth2 dengan Refresh Token (Akun Gmail Pribadi 15 GB / Workspace)
  const refreshToken = config.refreshToken || (config.tokens && config.tokens.refresh_token);
  if (oauth2Client && refreshToken) {
    const tokenPayload = sanitizeDriveCredentials({
      ...(config.tokens || {}),
      refresh_token: refreshToken,
      refreshToken,
    });

    oauth2Client.setCredentials(tokenPayload);
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  // Prioritas 2: Service Account (Drive Bersama / Google Workspace)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
      });
      return google.drive({ version: "v3", auth });
    } catch {}
  }

  if (fs.existsSync(SA_PATH)) {
    try {
      const content = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
      if (content.type === "service_account") {
        const auth = new google.auth.GoogleAuth({
          keyFile: SA_PATH,
          scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
        });
        return google.drive({ version: "v3", auth });
      }
    } catch {}
  }

  return null;
}

/**
 * Upload file PDF ke Google Drive
 * @param {string} filePath - Path file PDF lokal
 * @param {string} fileName - Nama file di Google Drive
 * @param {string} targetFolderId - (Opsional) ID folder tujuan (draft vs signed)
 * @returns {Promise<{fileId: string, webViewLink: string}|null>}
 */
async function uploadPdfToDrive(filePath, fileName, targetFolderId = null) {
  try {
    const drive = getDriveClient();
    const folderId = targetFolderId || getFolderId();

    if (!drive) {
      console.warn("⚠️ [Google Drive] Belum terhubung.");
      return null;
    }

    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : [],
    };

    const media = {
      mimeType: "application/pdf",
      body: fs.createReadStream(filePath),
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      resource: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink",
      supportsAllDrives: true,
    });

    try {
      await drive.permissions.create({
        fileId: res.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch {}

    console.log("☁️ [Google Drive] Berhasil upload ke folder", folderId || "root", ":", res.data.id);
    return {
      fileId: res.data.id,
      webViewLink: res.data.webViewLink,
      webContentLink: res.data.webContentLink,
    };
  } catch (err) {
    console.error("❌ [Google Drive] Gagal upload:", err.message);
    return null;
  }
}

module.exports = {
  getOAuth2Client,
  getDriveClient,
  uploadPdfToDrive,
  getDriveConfig,
  getFolderId,
  getDraftFolderId,
  getSignedFolderId,
  sanitizeDriveCredentials,
  CONFIG_PATH,
  TMP_CONFIG_PATH,
};
