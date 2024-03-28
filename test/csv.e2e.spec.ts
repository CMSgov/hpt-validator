import test from "ava"
import { validateCsv } from "../src/csv.js"
import { loadFixtureStream } from "./utils.js"

test("sample-1", async (t) => {
  t.deepEqual(
    (await validateCsv(loadFixtureStream("sample-1.csv"), "v1.1")).errors,
    [
      {
        field: "code | 1 | type",
        message:
          '"code | 1 | type" value "c" is not one of the allowed values: "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
        path: "C4",
        warning: true,
      },
      {
        field: "setting",
        message:
          '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
        path: "G4",
      },
      {
        field: "code | 1 | type",
        message:
          '"code | 1 | type" value "d" is not one of the allowed values: "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
        path: "C5",
        warning: true,
      },
      {
        field: "setting",
        message:
          '"setting" value "opatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
        path: "G5",
      },
    ]
  )
})

test("sample-1 maxErrors", async (t) => {
  t.deepEqual(
    (
      await validateCsv(loadFixtureStream("sample-1.csv"), "v1.1", {
        maxErrors: 1,
      })
    ).errors,
    [
      {
        field: "code | 1 | type",
        message:
          '"code | 1 | type" value "c" is not one of the allowed values: "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
        path: "C4",
        warning: true,
      },
      {
        field: "setting",
        message:
          '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
        path: "G4",
      },
    ]
  )
})

test("sample-2", async (t) => {
  t.deepEqual(
    (await validateCsv(loadFixtureStream("sample-2.csv"), "v1.1")).errors,
    [
      {
        field: "setting",
        message:
          '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
        path: "G4",
      },
    ]
  )
})
