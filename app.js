const PHI_TAGS = {
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

let currentBuffer = null;
let currentFileName = "";
let detectedTags = [];

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const sampleBtn = document.getElementById("sampleBtn");
const results = document.getElementById("results");
const tagTable = document.getElementById("tagTable");
const fileNameEl = document.getElementById("fileName");
const scrubBtn = document.getElementById("scrubBtn");
const errorBox = document.getElementById("errorBox");

browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
sampleBtn.addEventListener("click", loadSampleDicom);

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
  results.classList.add("hidden");
}

function handleFile(file) {
  if (!file) return;
  errorBox.classList.add("hidden");
  currentFileName = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      currentBuffer = new Uint8Array(e.target.result);
      detectedTags = parseDicomPhi(currentBuffer);
      renderTable(detectedTags);
    } catch (err) {
      showError(err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function buildSampleDicom() {
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

  // Append dummy Pixel Data tag (7FE0,0010)
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

function loadSampleDicom() {
  errorBox.classList.add("hidden");
  currentFileName = "sample_chest_xray.dcm";
  currentBuffer = buildSampleDicom();
  detectedTags = parseDicomPhi(currentBuffer);
  renderTable(detectedTags);
}

function parseDicomPhi(bytes) {
  const decoder = new TextDecoder("ascii");
  if (bytes.length < 132 || decoder.decode(bytes.slice(128, 132)) !== "DICM") {
    throw new Error("Invalid DICOM file: missing DICM header at byte 128.");
  }

  const view = new DataView(bytes.buffer);
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
      length = view.getUint32(offset + 8, true);
      valueOffset = offset + 12;
    } else {
      length = view.getUint16(offset + 6, true);
      valueOffset = offset + 8;
    }

    // Stop if undefined length sequence is encountered in MVP parser
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

function renderTable(tags) {
  fileNameEl.textContent = `${currentFileName} — ${tags.length} PHI tag(s) detected`;
  tagTable.innerHTML = "";

  if (tags.length === 0) {
    tagTable.innerHTML = `<tr><td colspan="4">No standard PHI tags found in header.</td></tr>`;
  } else {
    tags.forEach((t) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><code>${t.tag}</code></td>
        <td>${t.name}</td>
        <td>${t.value}</td>
        <td class="phi-flag">Will be scrubbed</td>
      `;
      tagTable.appendChild(row);
    });
  }

  results.classList.remove("hidden");
}

scrubBtn.addEventListener("click", () => {
  if (!currentBuffer) return;

  const scrubbed = new Uint8Array(currentBuffer);
  const replacement = "ANONYMIZED";

  detectedTags.forEach((t) => {
    for (let i = 0; i < t.length; i++) {
      // Preserve exact byte length: pad with ASCII space (0x20)
      scrubbed[t.offset + i] = i < replacement.length ? replacement.charCodeAt(i) : 0x20;
    }
  });

  const blob = new Blob([scrubbed], { type: "application/dicom" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anonymized_${currentFileName}`;
  a.click();
  URL.revokeObjectURL(url);
});
