# ClearDICOM

A lightweight, zero-backend, offline-first DICOM metadata inspector and PHI anonymizer built with vanilla HTML, CSS, and JavaScript.

## Why ClearDICOM?
Medical students, clinicians, and researchers frequently need to strip Protected Health Information (PHI) from `.dcm` files before sharing cases for teaching or research. Uploading patient scans to online tools violates privacy standards, while desktop suites are heavy to install. ClearDICOM runs 100% locally in your browser with zero external dependencies.

## Features
- **Zero Uploads:** All binary parsing and scrubbing happens locally in browser memory.
- **1-Click Sample Demo:** Generate a synthetic `.dcm` file directly in browser memory to test PHI inspection and scrubbing immediately.
- **Byte-Safe Anonymization:** Overwrites PHI tag values in-place while preserving exact byte lengths and pixel data integrity.
- **Offline Ready:** Open `index.html` directly or host on GitHub Pages.

## License
MIT
