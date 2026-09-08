const QRCode = require("qrcode");
const crypto = require("crypto");
const fs = require("fs");
const zlib = require("zlib");
const { PDFDocument, PDFName, PDFString } = require("pdf-lib");

/**
 * 1x1 Transparent PNG buffer untuk placeholder ruang tanda tangan pada draft
 */
const TRANSPARENT_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

/**
 * Menghitung SHA-256 hash dari buffer atau file
 * @param {Buffer} buffer 
 * @returns {string} SHA-256 hex string
 */
function calculateSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Menghasilkan QR code buffer PNG berisi URL verifikasi internal
 * @param {string} url 
 * @returns {Promise<Buffer>}
 */
async function generateQrCodeBuffer(url) {
  return await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 250,
    margin: 1,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

/**
 * Menanamkan layer Link Annotation pada gambar QR Code di PDF sehingga bisa diklik (clickable hyperlink)
 * @param {string} pdfPath Path ke file PDF
 * @param {string} targetUrl URL tujuan saat QR Code diklik
 * @returns {Promise<Uint8Array>} Buffer PDF final
 */
async function injectClickableQrLinkToPdf(pdfPath, targetUrl) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageIndex = pdfDoc.getPageCount() - 1; // Halaman tanda tangan biasanya halaman terakhir
  const page = pdfDoc.getPage(pageIndex);

  let qrRect = null;

  try {
    const contents = page.node.Contents();
    const contentStreams = [];
    if (contents && contents.asUint8Array) {
      contentStreams.push(contents);
    } else if (contents && contents.size && contents.get) {
      for (let i = 0; i < contents.size(); i++) {
        const stream = pdfDoc.context.lookup(contents.get(i));
        if (stream && stream.asUint8Array) contentStreams.push(stream);
      }
    }

    for (const streamObj of contentStreams) {
      const rawBytes = Buffer.from(streamObj.asUint8Array());
      let streamStr = "";
      try {
        streamStr = zlib.inflateSync(rawBytes).toString("utf-8");
      } catch {
        streamStr = rawBytes.toString("latin1");
      }

      const matches = [
        ...streamStr.matchAll(
          /([\d.]+)\s+0\s+0\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+cm\s*[\r\n]+\/(\w+)\s+Do/g
        ),
      ];

      for (const m of matches) {
        const [_, w, h, x, y, name] = m;
        const fw = parseFloat(w);
        const fh = parseFloat(h);
        const fx = parseFloat(x);
        const fy = parseFloat(y);
        // QR Code tanda tangan berada di bagian bawah lembar surat (y < 650)
        if (fy < 650) {
          qrRect = [fx, fy, fx + fw, fy + fh];
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ [signer] Gagal mendeteksi koordinat dinamis QR:", err.message);
  }

  // Koordinat fallback jika tidak terdeteksi dari stream
  if (!qrRect) {
    const { width, height } = page.getSize();
    qrRect = [width * 0.62, height * 0.38, width * 0.62 + 60, height * 0.38 + 60];
  }

  const linkAnnotation = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: qrRect,
    Border: [0, 0, 0],
    C: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(targetUrl),
    },
  });

  const linkRef = pdfDoc.context.register(linkAnnotation);

  let annots = page.node.get(PDFName.of("Annots"));
  if (!annots) {
    annots = pdfDoc.context.obj([]);
    page.node.set(PDFName.of("Annots"), annots);
  } else {
    annots = pdfDoc.context.lookup(annots);
  }
  annots.push(linkRef);

  const modifiedPdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, modifiedPdfBytes);
  return modifiedPdfBytes;
}

module.exports = {
  TRANSPARENT_1X1_PNG,
  calculateSha256,
  generateQrCodeBuffer,
  injectClickableQrLinkToPdf,
};

