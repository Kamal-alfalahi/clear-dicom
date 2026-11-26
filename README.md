# ClearDICOM

A zero-dependency, offline-first DICOM metadata inspector and byte-safe PHI anonymizer for **Node.js** and **browsers**.

**Live Demo:** https://kamal-alfalahi.github.io/clear-dicom/

## Installation

```bash
npm install clear-dicom
```

## Usage (Node.js & Browser ES Modules)

```javascript
import fs from "node:fs";
import { parseDicomPhi, scrubDicomPhi } from "clear-dicom";

const rawBytes = new Uint8Array(fs.readFileSync("scan.dcm"));

// 1. Inspect PHI tags
const tags = parseDicomPhi(rawBytes);
console.log(tags);

// 2. Scrub PHI in-place (preserves exact byte length & pixel data)
const { buffer } = scrubDicomPhi(rawBytes);
fs.writeFileSync("anonymized_scan.dcm", buffer);
```

## API

- `parseDicomPhi(bytes: Uint8Array)` — Returns an array of detected HIPAA PHI tags with values and byte offsets.
- `scrubDicomPhi(bytes: Uint8Array, replacement?: string)` — Returns `{ buffer, scrubbedTags }` with PHI overwritten in-place.
- `buildSampleDicom()` — Generates a synthetic DICOM Part 10 `Uint8Array` in memory for testing.

## Running Tests

```bash
npm test
```

## License
MIT
