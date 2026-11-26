export const PHI_TAGS = {
  "0010,0010": "Patient's Name",
  "0010,0020": "Patient ID",
  "0010,0030": "Patient's Birth Date",
  "0010,0040": "Patient's Sex",
  "0010,1000": "Other Patient IDs",
  "0008,0050": "Accession Number",
  "0008,0080": "Institution Name",
  "0008,0081": "Institution Address",
  "0008,0090": "Referring Physician's Name",
  "0008,1070": "Operators' Name"
};

const EXTENDED_VR = new Set(["OB", "OW", "OF", "SQ", "UT", "UN"]);

/**
 * Parse a DICOM Part 10 byte buffer and return detected PHI tags with byte offsets.
 * @param {Uint8Array} bytes
 * @returns {Array<{tag: string, name: string, value: string, offset: number, length: number}>}
 */
export function parseDicomPhi(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("Input must be a Uint8Array.");
  }

  const decoder = new TextDecoder("ascii");
  if (bytes.length < 132 || decoder.decode(bytes.slice(128, 132)) !== "DICM") {
    throw new Error("Invalid DICOM file: missing DICM header at byte 128.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = [];
  let offset = 132;

  while (offset + 8 < bytes.length) {
    const group = view.getUint16(offset, true).toString(16).padStart(4, "0").toUpperCase();
    const element = view.getUint16(offset + 2, true).toString(16).padStart(4, "0").toUpperCase();
    const tagKey = `${group},${element}`;

    // Stop at Pixel Data
    if (tagKey === "7FE0,0010") break;

    const vr = decoder.decode(bytes.slice(offset + 4, offset + 6));
    let length = 0;
    let valueOffset = 0;

    if (EXTENDED_VR.has(vr)) {
      if (offset + 12 > bytes.length) break;
      length = view.getUint32(offset + 8, true);
      valueOffset = offset + 12;
    } else {
      length = view.getUint16(offset + 6, true);
      valueOffset = offset + 8;
    }

    if (length === 0xffffffff || valueOffset + length > bytes.length) break;

    if (PHI_TAGS[tagKey]) {
      const rawValue = decoder.decode(bytes.slice(valueOffset, valueOffset + length)).trim();
      found.push({
        tag: `(${tagKey})`,
        name: PHI_TAGS[tagKey],
        value: rawValue || "(empty)",
        offset: valueOffset,
        length
      });
    }

    offset = valueOffset + length;
  }

  return found;
}

/**
 * Scrub PHI tags in-place on a cloned Uint8Array while preserving exact byte lengths.
 * @param {Uint8Array} bytes
 * @param {string} [replacement="ANONYMIZED"]
 * @returns {{ buffer: Uint8Array, scrubbedTags: Array }}
 */
export function scrubDicomPhi(bytes, replacement = "ANONYMIZED") {
  const tags = parseDicomPhi(bytes);
  const scrubbed = new Uint8Array(bytes);

  tags.forEach((t) => {
    for (let i = 0; i < t.length; i++) {
      scrubbed[t.offset + i] = i < replacement.length ? replacement.charCodeAt(i) : 0x20;
    }
  });

  return { buffer: scrubbed, scrubbedTags: tags };
}

/**
 * Generate a valid synthetic DICOM Part 10 buffer in memory for testing and demos.
 * @returns {Uint8Array}
 */
export function buildSampleDicom() {
  const encoder = new TextEncoder();
  const sampleFields = [
    [0x0008, 0x0050, "SH", "ACC-2026-0042"],
    [0x0008, 0x0080, "LO", "GENERAL TEACHING HOSPITAL"],
    [0x0008, 0x0090, "PN", "SMITH^JOHN^DR"],
    [0x0010, 0x0010, "PN", "DOE^JANE"],
    [0x0010, 0x0020, "LO", "MRN-984321"],
    [0x0010, 0x0030, "DA", "19880514"],
    [0x0010, 0x0040, "CS", "F"]
  ];

  const chunks = [];
  const preamble = new Uint8Array(132);
  preamble.set(encoder.encode("DICM"), 128);
  chunks.push(preamble);

  sampleFields.forEach(([group, element, vr, rawVal]) => {
    const valStr = rawVal.length % 2 === 1 ? rawVal + " " : rawVal;
    const valBytes = encoder.encode(valStr);
    const entry = new Uint8Array(8 + valBytes.length);
    const view = new DataView(entry.buffer);
    view.setUint16(0, group, true);
    view.setUint16(2, element, true);
    entry.set(encoder.encode(vr), 4);
    view.setUint16(6, valBytes.length, true);
    entry.set(valBytes, 8);
    chunks.push(entry);
  });

  const pixelChunk = new Uint8Array(16);
  const pixelView = new DataView(pixelChunk.buffer);
  pixelView.setUint16(0, 0x7fe0, true);
  pixelView.setUint16(2, 0x0010, true);
  pixelChunk.set(encoder.encode("OB"), 4);
  pixelView.setUint32(8, 4, true);
  chunks.push(pixelChunk);

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let pos = 0;
  chunks.forEach((c) => {
    combined.set(c, pos);
    pos += c.length;
  });
  return combined;
}
