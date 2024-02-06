import test from "ava"
import { validateCsv } from "../../src/csv.js"
import { loadFixtureStream } from "../utils.js"

test("validateCsvTall", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-tall-valid.csv"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})

test("validateCsvWide", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-valid.csv"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})

test("validateCsvWideHeaderError", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-error-header.csv"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors, [
    {
      path: "BA1",
      field: "hospital_location",
      message:
        'Header column should be "hospital_location", but it is not present',
    },
    {
      path: "A1",
      message: "Errors were seen in headers so rows were not evaluated",
    },
  ])
})

test("validateCsvWideMissingValueError", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-error-missing-value.csv"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors, [
    { path: "B4", field: "code | 1", message: '"code | 1" is required' },
  ])
})

test("validateCsvWideMissingEnumError", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-error-bad-enum.csv"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors, [
    {
      path: "C4",
      field: "code | 1 | type",
      message:
        '"code | 1 | type" value "ms-drgg" is not one of the allowed values: "CPT", "HCPCS", "ICD", "DRG", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM", "TRIS-DRG"',
    },
  ])
})
