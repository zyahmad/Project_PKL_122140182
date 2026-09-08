const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const CONFIG_PATH = path.join(__dirname, "drive-config.json");
const OAUTH_PATH = path.join(__dirname, "service-account.json.json");
const SA_PATH = path.join(__dirname, "service-account.json");

/**
 * Membaca konfigurasi drive-config.json
 */
function getDriveConfig() {
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

function getOAuth2Client() {
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
          const redirect_uri = (redirect_uris && redirect_uris[0]) || "http://localhost:3000/oauth2callback";
          return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
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

  // Prioritas 1: OAuth2 dengan Refresh Token (Menggunakan Kuota Akun Gmail Pribadi 15 GB)
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
 * @returns {Promise<{fileId: string, webViewLink: string}|null>}
 */
async function uploadPdfToDrive(filePath, fileName) {
  try {
    const drive = getDriveClient();
    const folderId = getFolderId();

    if (!drive) {
      console.warn("⚠️ [Google Drive] Belum terhubung. Akses http://localhost:3000/auth/google untuk menghubungkan akun Gmail Anda.");
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

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      supportsAllDrives: true,
      supportsTeamDrives: true,
      fields: "id, webViewLink, webContentLink",
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

    // Buat file dapat dilihat oleh siapa saja yang memiliki link (Anyone with link can view)
    try {
      await drive.permissions.create({
        fileId: fileId,
        supportsAllDrives: true,
        supportsTeamDrives: true,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (permErr) {
      console.warn("⚠️ [Google Drive] Gagal mengubah izin file publik:", permErr.message);
    }

    console.log(`✅ [Google Drive] File ter-upload: ${fileName} (ID: ${fileId})`);
    return {
      fileId,
      webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (error) {
    if (error.message && error.message.includes("storage quota")) {
      console.error("\n❌ [Google Drive Quota Error] Service Account tidak memiliki kuota di folder pribadi.");
      console.error("👉 SOLUSI: Hubungkan akun Gmail pribadi Anda via http://localhost:3000/auth/google untuk menggunakan kuota 15 GB pribadi.\n");
    } else {
      console.error("❌ [Google Drive] Gagal mengunggah file PDF:", error.message);
    }
    return null;
  }
}

module.exports = {
  uploadPdfToDrive,
  getFolderId,
  getOAuth2Client,
  getDriveConfig,
  sanitizeDriveCredentials,
  shouldRefreshDriveToken,
  CONFIG_PATH,
};
