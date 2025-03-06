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

test("validateCsv mixed line endings", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-tall-mixed-line-endings.csv"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})

test("validateCsvTall quoted column name", async (t) => {
  // this test shows correct behavior when a file contains a BOM and the first column name is quoted
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-tall-valid-quoted.csv"),
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
      path: "row 1",
      field: "hospital_location",
      message:
        'Header column "hospital_location" is miscoded or missing. You must include this header and confirm that it is encoded as specified in the data dictionary.',
    },
    {
      path: "G2",
      field:
        "to the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 cfr 180.50, and the information encoded is true, accurate, and complete as of the date indicated.",
      message:
        '"to the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 cfr 180.50, and the information encoded is true, accurate, and complete as of the date indicated." value "yes" is not one of the allowed valid values. You must encode one of these valid values: true, false',
    },
    {
      path: "A1",
      message:
        "Errors were found in the headers or values in rows 1 through 3, so the remaining rows were not evaluated.",
    },
  ])
})

test("validateCsvHeaderEmpty", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-header-empty.csv"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.is(result.errors.length, 7)
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
      path: "row 3",
      field:
        "standard_charge | platform_health_insurance | ppo | negotiated_dollar",
      message:
        "Column standard_charge | platform_health_insurance | ppo | negotiated_dollar is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.",
    },
    {
      path: "A1",
      message:
        "Errors were found in the headers or values in rows 1 through 3, so the remaining rows were not evaluated.",
    },
  ])
})

test("validate columns with date-dependent enforcement", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-wide-missing-new-columns.csv"),
    "v2.0"
  )
  const enforce2025 = new Date().getFullYear() >= 2025
  if (enforce2025) {
    t.is(result.valid, false)
    t.deepEqual(result.errors, [
      {
        path: "row 3",
        field: "drug_unit_of_measurement",
        message:
          "Column drug_unit_of_measurement is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.",
      },
      {
        path: "row 3",
        field: "drug_type_of_measurement",
        message:
          "Column drug_type_of_measurement is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.",
      },
      {
        path: "A1",
        message:
          "Errors were found in the headers or values in rows 1 through 3, so the remaining rows were not evaluated.",
      },
    ])
  } else {
    t.is(result.valid, true)
    t.deepEqual(result.errors, [
      {
        path: "row 3",
        field: "drug_unit_of_measurement",
        message:
          "Column drug_unit_of_measurement is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.",
        warning: true,
      },
      {
        path: "row 3",
        field: "drug_type_of_measurement",
        message:
          "Column drug_type_of_measurement is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.",
        warning: true,
      },
    ])
  }
})
