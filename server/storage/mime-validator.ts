import path from "node:path";

export interface MimeValidationResult {
  isValid: boolean;
  detectedMime: string;
  sanitizedFileName: string;
  reason?: string;
}

/**
 * Sniffs the MIME type from the first few bytes of a file.
 */
export function sniffMimeType(
  header: Buffer,
  declaredMime?: string,
  fileName?: string
): string {
  if (header.length >= 5 && header.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }

  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    header.length >= 6 &&
    (header.subarray(0, 6).toString("latin1") === "GIF87a" ||
      header.subarray(0, 6).toString("latin1") === "GIF89a")
  ) {
    return "image/gif";
  }

  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("latin1") === "RIFF" &&
    header.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("latin1") === "RIFF" &&
    header.subarray(8, 12).toString("latin1") === "WAVE"
  ) {
    return "audio/wav";
  }

  if (header.length >= 4 && header.subarray(0, 4).toString("latin1") === "OggS") {
    return "audio/ogg";
  }

  if (header.length >= 3 && header.subarray(0, 3).toString("latin1") === "ID3") {
    return "audio/mpeg";
  }

  if (
    header.length >= 2 &&
    header[0] === 0xff &&
    (header[1] & 0xe0) === 0xe0
  ) {
    return "audio/mpeg";
  }

  if (
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  ) {
    // EBML container (WebM / Matroska)
    if (fileName && /\.(webm)$/i.test(fileName)) {
      return "video/webm";
    }
    return "video/webm";
  }

  if (header.length >= 8 && header.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = header.subarray(8, 12).toString("latin1").trim();
    if (brand === "M4A " || brand === "M4B " || (fileName && /\.m4a$/i.test(fileName))) {
      return "audio/mp4";
    }
    if (brand === "qt  " || (fileName && /\.mov$/i.test(fileName))) {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  if (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07) &&
    (header[3] === 0x04 || header[3] === 0x06 || header[3] === 0x08)
  ) {
    // Zip archive based format (DOCX, XLSX, EPUB, etc.)
    if (fileName && /\.docx$/i.test(fileName)) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (fileName && /\.epub$/i.test(fileName)) {
      return "application/epub+zip";
    }
    return "application/zip";
  }

  // Check if buffer looks like valid UTF-8 text (no null bytes in reasonable header)
  let isText = true;
  for (let i = 0; i < Math.min(header.length, 512); i++) {
    if (header[i] === 0x00) {
      isText = false;
      break;
    }
  }

  if (isText && header.length > 0) {
    if (fileName) {
      if (/\.md$/i.test(fileName) || /\.markdown$/i.test(fileName)) {
        return "text/markdown";
      }
      if (/\.json$/i.test(fileName)) {
        return "application/json";
      }
      if (/\.txt$/i.test(fileName)) {
        return "text/plain";
      }
      if (/\.csv$/i.test(fileName)) {
        return "text/csv";
      }
    }
    if (declaredMime && (declaredMime.startsWith("text/") || declaredMime === "application/json")) {
      return declaredMime;
    }
    return "text/plain";
  }

  return declaredMime || "application/octet-stream";
}

/**
 * Sanitizes a file name, removing path traversal sequences and special characters.
 */
export function sanitizeFileName(rawFileName: string): string {
  if (!rawFileName || typeof rawFileName !== "string") {
    return "unnamed_asset";
  }

  // Remove NUL bytes
  const clean = rawFileName.replace(/\0/g, "");
  // Take only the basename
  const base = path.basename(clean).trim();
  // Filter out traversal tokens
  const sanitized = base.replace(/[/\\]/g, "_").replace(/^\.+/, "");

  return sanitized.length > 0 ? sanitized : "unnamed_asset";
}

/**
 * Validates declared MIME type against actual binary header.
 * Rejects obvious spoofing (e.g. executable/corrupted payload claiming to be image or audio).
 */
export function validateMimeType(
  declaredMime: string | undefined,
  header: Buffer,
  rawFileName: string
): MimeValidationResult {
  const sanitizedFileName = sanitizeFileName(rawFileName);

  // Path traversal check on the raw file name:
  // If the raw filename had traversal sequences like '../', it's suspicious
  if (rawFileName.includes("..") || rawFileName.includes("/") || rawFileName.includes("\\")) {
    // Notice: we can still accept sanitized name, but reject if dangerous traversal is attempted
    if (rawFileName.startsWith("../") || rawFileName.includes("/../") || rawFileName.includes("\\..\\")) {
      return {
        isValid: false,
        detectedMime: "application/octet-stream",
        sanitizedFileName,
        reason: "Path traversal sequence detected in file name",
      };
    }
  }

  const detectedMime = sniffMimeType(header, declaredMime, sanitizedFileName);

  // If declared MIME is provided, check for critical mismatches (spoofing)
  if (declaredMime) {
    const normDeclared = declaredMime.toLowerCase().trim();
    const normDetected = detectedMime.toLowerCase().trim();

    // Check: image declared but detected as non-image binary or text
    if (normDeclared.startsWith("image/") && !normDetected.startsWith("image/")) {
      return {
        isValid: false,
        detectedMime,
        sanitizedFileName,
        reason: `MIME spoof detected: declared '${declaredMime}' but content header is '${detectedMime}'`,
      };
    }

    // Check: audio declared but detected as non-audio binary
    if (normDeclared.startsWith("audio/") && !normDetected.startsWith("audio/")) {
      return {
        isValid: false,
        detectedMime,
        sanitizedFileName,
        reason: `MIME spoof detected: declared '${declaredMime}' but content header is '${detectedMime}'`,
      };
    }

    // Check: video declared but detected as non-video binary
    if (normDeclared.startsWith("video/") && !normDetected.startsWith("video/")) {
      return {
        isValid: false,
        detectedMime,
        sanitizedFileName,
        reason: `MIME spoof detected: declared '${declaredMime}' but content header is '${detectedMime}'`,
      };
    }

    // Check: PDF declared but magic bytes missing
    if (normDeclared === "application/pdf" && normDetected !== "application/pdf") {
      return {
        isValid: false,
        detectedMime,
        sanitizedFileName,
        reason: `MIME spoof detected: declared 'application/pdf' but '%PDF-' magic bytes missing`,
      };
    }
  }

  return {
    isValid: true,
    detectedMime,
    sanitizedFileName,
  };
}

