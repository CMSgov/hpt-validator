import test from "ava"
import { validateCsvSync, validateCsv } from "../src/csv.js"
import { loadFixture, loadFixtureStream } from "./utils.js"

test("sample-1", async (t) => {
  t.deepEqual((await validateCsv(loadFixtureStream("sample-1.csv"))).errors, [
    {
      field: "code | 1 | type",
      message:
        '"code | 1 | type" value "C" is not one of the allowed values: "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
      path: "C4",
      warning: true,
    },
    {
      field: "billing_class",
      message:
        '"billing_class" value "Facility" is not one of the allowed values: "professional", "facility"',
      path: "F4",
    },
    {
      field: "setting",
      message:
        '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
      path: "G4",
    },
  ])
})

test("sample-1 sync", (t) => {
  t.deepEqual(validateCsvSync(loadFixture("sample-1.csv")).errors, [
    {
      field: "code | 1 | type",
      message:
        '"code | 1 | type" value "C" is not one of the allowed values: "CPT", "HCPCS", "ICD", "MS-DRG", "R-DRG", "S-DRG", "APS-DRG", "AP-DRG", "APR-DRG", "APC", "NDC", "HIPPS", "LOCAL", "EAPG", "CDT", "RC", "CDM"',
      path: "C4",
      warning: true,
    },
    {
      field: "billing_class",
      message:
        '"billing_class" value "Facility" is not one of the allowed values: "professional", "facility"',
      path: "F4",
    },
    {
      field: "setting",
      message:
        '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
      path: "G4",
    },
  ])
})

test("sample-2", async (t) => {
  t.deepEqual((await validateCsv(loadFixtureStream("sample-2.csv"))).errors, [
    {
      field: "financial_aid_policy",
      message: '"financial_aid_policy" is blank',
      path: "E2",
      warning: true,
    },
    {
      field: "billing_class",
      message:
        '"billing_class" value "Facility" is not one of the allowed values: "professional", "facility"',
      path: "F4",
    },
    {
      field: "setting",
      message:
        '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
      path: "G4",
    },
  ])
})

test("sample-2 sync", (t) => {
  t.deepEqual(validateCsvSync(loadFixture("sample-2.csv")).errors, [
    {
      field: "financial_aid_policy",
      message: '"financial_aid_policy" is blank',
      path: "E2",
      warning: true,
    },
    {
      field: "billing_class",
      message:
        '"billing_class" value "Facility" is not one of the allowed values: "professional", "facility"',
      path: "F4",
    },
    {
      field: "setting",
      message:
        '"setting" value "ipatient" is not one of the allowed values: "inpatient", "outpatient", "both"',
      path: "G4",
    },
  ])
})
