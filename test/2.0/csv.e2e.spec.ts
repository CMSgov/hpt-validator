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
        'Header column "hospital_location" is miscoded or missing. You must include this header and confirm that it is encoded as specified in the data dictionary.',
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
    {
      path: "B4",
      field: "code | 1",
      message:
        'A value is required for "code | 1". You must encode the missing information.',
    },
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
        '"code | 1 | type" value "ms-drgg" is not one of the allowed valid values. You must encode one of these valid values: CPT, HCPCS, ICD, DRG, MS-DRG, R-DRG, S-DRG, APS-DRG, AP-DRG, APR-DRG, APC, NDC, HIPPS, LOCAL, EAPG, CDT, RC, CDM, TRIS-DRG',
    },
  ])
})

test("validateCsvWideMissingMissingRequiredColumnError", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-error-header-standardcharge.csv"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors, [
    {
      path: "BA3",
      field:
        "standard_charge | platform_health_insurance | ppo | negotiated_dollar",
      message:
        "Column standard_charge | platform_health_insurance | ppo | negotiated_dollar is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.",
    },
    {
      path: "A1",
      message: "Errors were seen in headers so rows were not evaluated",
    },
  ])
})
