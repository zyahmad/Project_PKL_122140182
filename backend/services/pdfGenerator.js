const fs = require("fs");
const path = require("path");

// Path ke aset logo dan font resmi
const LOGO_PATH = path.join(__dirname, "..", "templates", "kemenag_logo.png");
const FONTS_DIR = path.join(__dirname, "..", "templates", "fonts");

let logoBase64Cache = null;
let timesRegularBase64 = null;
let timesBoldBase64 = null;
let timesItalicBase64 = null;

function getLogoBase64() {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const buf = fs.readFileSync(LOGO_PATH);
      logoBase64Cache = `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch (err) {
    console.warn("⚠️ Gagal membaca logo Kemenag:", err.message);
  }
  return logoBase64Cache || "";
}

function getTimesFontsBase64() {
  if (!timesRegularBase64) {
    try {
      const p = path.join(FONTS_DIR, "times.ttf");
      if (fs.existsSync(p)) timesRegularBase64 = fs.readFileSync(p).toString("base64");
    } catch {}
  }
  if (!timesBoldBase64) {
    try {
      const p = path.join(FONTS_DIR, "timesbd.ttf");
      if (fs.existsSync(p)) timesBoldBase64 = fs.readFileSync(p).toString("base64");
    } catch {}
  }
  if (!timesItalicBase64) {
    try {
      const p = path.join(FONTS_DIR, "timesi.ttf");
      if (fs.existsSync(p)) timesItalicBase64 = fs.readFileSync(p).toString("base64");
    } catch {}
  }
  return {
    regular: timesRegularBase64,
    bold: timesBoldBase64,
    italic: timesItalicBase64,
  };
}

/**
 * Deteksi path executable browser untuk lingkungan lokal (Windows / Linux / Mac)
 */
function getLocalBrowserPath() {
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
  } else if (process.platform === "darwin") {
    const macCandidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const p of macCandidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxCandidates = [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];
    for (const p of linuxCandidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * Launch Chromium instance sesuai lingkungan (Vercel Serverless vs Local Dev)
 */
async function launchBrowser() {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV
  );

  const puppeteerMod = await import("puppeteer-core");
  const puppeteer = puppeteerMod.default || puppeteerMod;

  if (isServerless) {
    const chromiumMod = await import("@sparticuz/chromium").catch(() => require("@sparticuz/chromium"));
    const chromium = chromiumMod.default || chromiumMod;
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    const localPath = getLocalBrowserPath();
    if (!localPath) {
      throw new Error(
        "Browser lokal (Chrome / Edge) tidak ditemukan pada sistem ini. Harap pasang Google Chrome atau Microsoft Edge."
      );
    }
    return await puppeteer.launch({
      executablePath: localPath,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
}

/**
 * Menghasilkan HTML surat berstandar resmi A4 Kanwil Kemenag (100% Persis Template DOCX)
 */
function renderSuratHtml(data, options = {}) {
  const logoSrc = getLogoBase64();
  const fonts = getTimesFontsBase64();
  const { qrDataUrl, verificationUrl, isDraft = false } = options;

  const tempatSurat = data.tempat_surat || "Bandar Lampung";
  const tanggalSurat = data.tanggal || "";
  const nomorSurat = data.nomor_surat || "-";
  const sifat = data.sifat || "Biasa";
  const lampiran = data.lampiran || "-";
  const hal = data.hal || "Surat Rekomendasi";
  const tujuan = data.tujuan || "-";
  const lokasiTujuan = data.lokasi_tujuan || "Bandar Lampung";
  const jabatan = data.jabatan_penandatangan || "Kepala Bidang";
  const nama = data.nama_penandatangan || "-";
  const nip = data.nip_penandatangan || "-";

  // Format paragraf isi surat
  const paragraphs = String(data.isi_surat || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="paragraph">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  // Tanda tangan QR Code atau ruang kosong jika draft
  let signatureBlockHtml = "";
  if (qrDataUrl) {
    const qrLink = verificationUrl
      ? `<a href="${verificationUrl}" target="_blank" title="Klik untuk verifikasi keaslian dokumen"><img src="${qrDataUrl}" alt="QR Tanda Tangan Elektronik" class="qr-code" /></a>`
      : `<img src="${qrDataUrl}" alt="QR Tanda Tangan Elektronik" class="qr-code" />`;

    signatureBlockHtml = `
      <div class="qr-wrapper">
        ${qrLink}
      </div>
    `;
  } else {
    signatureBlockHtml = `<div class="signature-space"></div>`;
  }

  const watermarkHtml = isDraft
    ? `<div class="watermark">DRAFT / PRATINJAU</div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Surat Rekomendasi - ${nomorSurat}</title>
  <style>
    ${fonts.regular ? `
    @font-face {
      font-family: 'Times New Roman';
      src: url('data:font/truetype;charset=utf-8;base64,${fonts.regular}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    ` : `@import url('https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap');`}
    ${fonts.bold ? `
    @font-face {
      font-family: 'Times New Roman';
      src: url('data:font/truetype;charset=utf-8;base64,${fonts.bold}') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    ` : ''}
    ${fonts.italic ? `
    @font-face {
      font-family: 'Times New Roman';
      src: url('data:font/truetype;charset=utf-8;base64,${fonts.italic}') format('truetype');
      font-weight: normal;
      font-style: italic;
    }
    ` : ''}

    @page {
      size: A4 portrait;
      margin: 20mm 20mm 20mm 30mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Times New Roman", "Tinos", Times, serif;
      font-size: 12pt;
      line-height: 1.35;
      color: #000;
      background: #fff;
      position: relative;
    }

    .watermark {
      position: fixed;
      top: 40%;
      left: 10%;
      right: 10%;
      text-align: center;
      font-size: 44pt;
      font-weight: bold;
      color: rgba(220, 38, 38, 0.12);
      transform: rotate(-30deg);
      pointer-events: none;
      z-index: 9999;
      letter-spacing: 4px;
    }

    /* KOP SURAT (Tabel 3-Kolom Sesuai Template DOCX) */
    .kop-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 2px;
    }

    .kop-logo-col {
      width: 82px;
      vertical-align: middle;
      text-align: left;
    }

    .kop-logo-col img {
      width: 78px;
      height: auto;
      display: block;
    }

    .kop-spacer-col {
      width: 82px;
    }

    .kop-text-col {
      text-align: center;
      vertical-align: middle;
    }

    .kop-line-1 {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      line-height: 1.15;
    }

    .kop-line-2 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      line-height: 1.15;
    }

    .kop-line-3 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
      line-height: 1.15;
    }

    .kop-line-address {
      font-size: 10pt;
      line-height: 1.2;
    }

    .kop-line-contact {
      font-size: 9pt;
      line-height: 1.2;
    }

    .kop-line-web {
      font-size: 9pt;
      line-height: 1.2;
    }

    /* Garis Ganda Pemisah Kop Surat (Sesuai Standar Resmi) */
    .kop-divider {
      border: 0;
      border-top: 3px solid #000;
      border-bottom: 1px solid #000;
      height: 4px;
      margin: 4px 0 16px 0;
    }

    /* TABEL ATRIBUT SURAT & TANGGAL */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 16px;
      font-size: 12pt;
    }

    .meta-table td {
      vertical-align: top;
      padding: 1px 0;
    }

    .meta-left {
      width: 55%;
    }

    .meta-right {
      width: 45%;
      text-align: right;
      white-space: nowrap;
      font-size: 12pt;
    }

    .inner-attr-table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12pt;
    }

    .inner-attr-table td {
      padding: 1px 0;
      vertical-align: top;
    }

    .attr-label {
      width: 60px;
      white-space: nowrap;
    }

    .attr-sep {
      width: 14px;
      text-align: center;
      white-space: nowrap;
    }

    .attr-val {
      font-weight: normal;
    }

    /* TUJUAN */
    .destination-section {
      margin-bottom: 16px;
      line-height: 1.35;
      font-size: 12pt;
    }

    .destination-section .yth {
      margin-bottom: 1px;
    }

    .destination-section .location {
      padding-left: 28px;
    }

    /* SALAM & ISI SURAT */
    .greeting {
      margin-bottom: 10px;
      font-size: 12pt;
    }

    .content-body {
      margin-bottom: 12px;
      text-align: justify;
      line-height: 1.4;
      font-size: 12pt;
    }

    .paragraph {
      text-indent: 32px;
      margin-bottom: 10px;
      text-align: justify;
    }

    .closing-text {
      margin-top: 10px;
      margin-bottom: 18px;
      text-indent: 32px;
      text-align: justify;
      font-size: 12pt;
      line-height: 1.4;
    }

    /* TANDA TANGAN (Sesuai Posisi Template DOCX) */
    .signature-section {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      margin-top: 14px;
      page-break-inside: avoid;
      font-size: 12pt;
    }

    .signature-box {
      width: 270px;
      text-align: left;
    }

    .signature-box .salutation {
      margin-bottom: 2px;
      font-weight: normal;
    }

    .signature-box .position {
      margin-bottom: 4px;
      font-weight: normal;
    }

    .qr-wrapper {
      margin: 6px 0;
      display: inline-block;
      text-align: left;
    }

    .qr-code {
      width: 82px;
      height: 82px;
      display: block;
    }

    .signature-space {
      height: 82px;
      margin: 6px 0;
    }

    .signature-name {
      font-weight: bold;
      text-decoration: underline;
      font-size: 12pt;
      margin-top: 4px;
    }

    .signature-nip {
      font-size: 12pt;
      font-weight: normal;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  ${watermarkHtml}

  <!-- KOP SURAT (Logo | Teks Kop Tengah | Spacer Kanan) -->
  <table class="kop-table">
    <tr>
      <td class="kop-logo-col">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo Kemenag" />` : ""}
      </td>
      <td class="kop-text-col">
        <div class="kop-line-1">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
        <div class="kop-line-2">KANTOR WILAYAH KEMENTERIAN AGAMA</div>
        <div class="kop-line-3">PROVINSI LAMPUNG</div>
        <div class="kop-line-address">Jalan Cut Meutia No.27 Teluk Betung 35214</div>
        <div class="kop-line-contact">Telepon (0721) 481533 - Faksimile (0721) 483067</div>
        <div class="kop-line-web">Website: lampung.kemenag.go.id</div>
      </td>
      <td class="kop-spacer-col"></td>
    </tr>
  </table>
  <div class="kop-divider"></div>

  <!-- ATRIBUT & TANGGAL -->
  <table class="meta-table">
    <tr>
      <td class="meta-left">
        <table class="inner-attr-table">
          <tr>
            <td class="attr-label">Nomor</td>
            <td class="attr-sep">:</td>
            <td class="attr-val">${nomorSurat}</td>
          </tr>
          <tr>
            <td class="attr-label">Sifat</td>
            <td class="attr-sep">:</td>
            <td class="attr-val">${sifat}</td>
          </tr>
          <tr>
            <td class="attr-label">Lamp.</td>
            <td class="attr-sep">:</td>
            <td class="attr-val">${lampiran}</td>
          </tr>
          <tr>
            <td class="attr-label">Hal</td>
            <td class="attr-sep">:</td>
            <td class="attr-val">${hal}</td>
          </tr>
        </table>
      </td>
      <td class="meta-right">
        <div>${tempatSurat}, ${tanggalSurat}</div>
      </td>
    </tr>
  </table>

  <!-- TUJUAN SURAT -->
  <div class="destination-section">
    <div class="yth">Yth. ${tujuan}</div>
    <div>di -</div>
    <div class="location">${lokasiTujuan}</div>
  </div>

  <!-- SALAM & ISI SURAT -->
  <div class="greeting">Assalamu'alaikum Wr. Wb.</div>
  
  <div class="content-body">
    ${paragraphs || "<p class=\"paragraph\">-</p>"}
  </div>

  <div class="closing-text">
    Demikian surat rekomendasi ini kami sampaikan, atas perhatiannya diucapkan terimakasih.
  </div>

  <!-- TANDA TANGAN RESMI (Sesuai Template DOCX) -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="salutation">Wassalam,</div>
      <div class="position">${jabatan},</div>
      ${signatureBlockHtml}
      <div class="signature-name">${nama}</div>
      <div class="signature-nip">NIP. ${nip}</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Menghasilkan Buffer PDF dari data surat
 * @param {object} data Objek data surat
 * @param {object} options Opsi render { qrDataUrl, verificationUrl, isDraft }
 * @returns {Promise<Buffer>}
 */
async function generateSuratPdf(data, options = {}) {
  const html = renderSuratHtml(data, options);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "30mm",
        right: "20mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

module.exports = {
  renderSuratHtml,
  generateSuratPdf,
  getLogoBase64,
  getTimesFontsBase64,
};
