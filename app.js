import { parseDicomPhi, scrubDicomPhi, buildSampleDicom } from "./src/index.js";

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

function loadSampleDicom() {
  errorBox.classList.add("hidden");
  currentFileName = "sample_chest_xray.dcm";
  currentBuffer = buildSampleDicom();
  detectedTags = parseDicomPhi(currentBuffer);
  renderTable(detectedTags);
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

  const { buffer } = scrubDicomPhi(currentBuffer);
  const blob = new Blob([buffer], { type: "application/dicom" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anonymized_${currentFileName}`;
  a.click();
  URL.revokeObjectURL(url);
});
