import test from "node:test";
import assert from "node:assert/strict";
import { parseDicomPhi, scrubDicomPhi, buildSampleDicom } from "../src/index.js";

test("parseDicomPhi detects all 7 PHI tags in synthetic sample", () => {
  const sample = buildSampleDicom();
  const tags = parseDicomPhi(sample);

  assert.equal(tags.length, 7);
  const patientName = tags.find((t) => t.tag === "(0010,0010)");
  assert.ok(patientName);
  assert.equal(patientName.value, "DOE^JANE");
});

test("scrubDicomPhi overwrites PHI while preserving exact byte length", () => {
  const sample = buildSampleDicom();
  const { buffer, scrubbedTags } = scrubDicomPhi(sample);

  assert.equal(buffer.length, sample.length);
  assert.equal(scrubbedTags.length, 7);

  const after = parseDicomPhi(buffer);
  after.forEach((t) => {
    assert.ok(!t.value.includes("DOE^JANE"));
    assert.ok(!t.value.includes("MRN-984321"));
    assert.ok(!t.value.includes("GENERAL TEACHING HOSPITAL"));
  });
});

test("parseDicomPhi throws on invalid DICOM buffer", () => {
  assert.throws(() => parseDicomPhi(new Uint8Array(64)), /missing DICM header/);
});
