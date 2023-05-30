import test from "ava"
import { validateCsvSync, validateCsv } from "../src/csv.js"
import { loadFixture, loadFixtureStream } from "./utils.js"

test("sample-1", async (t) => {
  t.deepEqual((await validateCsv(loadFixtureStream("sample-1.csv"))).errors, [
    {
      message: '"code | 2" is required',
      path: "D4",
    },
    {
      message:
        '"code | 1 | type" value "C" is not in "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
      path: "C4",
      warning: true,
    },
    {
      message:
        '"billing_class" value "Facility" is not in "professional", "facility"',
      path: "F4",
    },
    {
      message:
        '"setting" value "ipatient" is not in "inpatient", "outpatient", "both", "-1"',
      path: "G4",
    },
  ])
})

test("sample-1 sync", (t) => {
  t.deepEqual(validateCsvSync(loadFixture("sample-1.csv")).errors, [
    {
      message: '"code | 2" is required',
      path: "D4",
    },
    {
      message:
        '"code | 1 | type" value "C" is not in "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
      path: "C4",
      warning: true,
    },
    {
      message:
        '"billing_class" value "Facility" is not in "professional", "facility"',
      path: "F4",
    },
    {
      message:
        '"setting" value "ipatient" is not in "inpatient", "outpatient", "both", "-1"',
      path: "G4",
    },
  ])
})

test("sample-2", async (t) => {
  t.deepEqual((await validateCsv(loadFixtureStream("sample-2.csv"))).errors, [
    {
      message: '"financial_aid_policy" is blank',
      path: "E2",
      warning: true,
    },
    {
      message: '"code | 2" is required',
      path: "D4",
    },
    {
      message:
        '"billing_class" value "Facility" is not in "professional", "facility"',
      path: "F4",
    },
    {
      message:
        '"setting" value "ipatient" is not in "inpatient", "outpatient", "both", "-1"',
      path: "G4",
    },
  ])
})

test("sample-2 sync", (t) => {
  t.deepEqual(validateCsvSync(loadFixture("sample-2.csv")).errors, [
    {
      message: '"financial_aid_policy" is blank',
      path: "E2",
      warning: true,
    },
    {
      message: '"code | 2" is required',
      path: "D4",
    },
    {
      message:
        '"billing_class" value "Facility" is not in "professional", "facility"',
      path: "F4",
    },
    {
      message:
        '"setting" value "ipatient" is not in "inpatient", "outpatient", "both", "-1"',
      path: "G4",
    },
  ])
})
