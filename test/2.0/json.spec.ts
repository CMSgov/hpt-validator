import test from "ava"
import { loadFixtureStream } from "../utils.js"
import { validateJson } from "../../src/json.js"

test("validateJson", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-valid.json"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
  t.is(result.alerts.length, 0)
})

test("validateJson BOM", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-valid-bom.json"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
  t.is(result.alerts.length, 0)
})

test("validateJson empty", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-empty.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 8)
  t.is(result.alerts.length, 0)
})

test("validateJson syntactically invalid", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-invalid.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 1)
  t.is(result.alerts.length, 0)
})

test("validateJson maxErrors", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-empty.json"),
    "v2.0",
    {
      maxErrors: 1,
    }
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 1)
  t.is(result.alerts.length, 0)
})

test("validateJson errorFile", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-errors.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 3)
  t.is(result.alerts.length, 0)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/0/standard_charge_dollar",
      field: "standard_charge_dollar",
      message: "must be number",
    },
    {
      path: "/standard_charge_information/3/standard_charges/0/payers_information/2",
      field: "2",
      message: "must have required property 'methodology'",
    },
    {
      path: "/affirmation/affirmation",
      field: "affirmation",
      message: "must be equal to constant",
    },
  ])
})

test("validateJsonConditionals", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-errors.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 2)
  t.is(result.alerts.length, 0)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/3/standard_charges/0/payers_information/2",
      field: "2",
      message: "must have required property 'additional_payer_notes'",
    },
    {
      path: "/standard_charge_information/3/standard_charges/0/payers_information/2",
      field: "2",
      message: 'must match "then" schema',
    },
  ])

  const result2 = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-error-standardcharge.json"),
    "v2.0"
  )
  t.is(result2.valid, false)
  t.deepEqual(result2.errors.length, 11)
  t.is(result.alerts.length, 0)
  t.deepEqual(result2.errors, [
    {
      path: "/standard_charge_information/0/standard_charges/0",
      field: "0",
      message: "must have required property 'gross_charge'",
    },
    {
      path: "/standard_charge_information/0/standard_charges/0",
      field: "0",
      message: "must have required property 'discounted_cash'",
    },
    {
      path: "/standard_charge_information/0/standard_charges/0",
      field: "0",
      message: "must have required property 'payers_information'",
    },
    {
      path: "/standard_charge_information/0/standard_charges/0",
      field: "0",
      message: "must match a schema in anyOf",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0",
      field: "0",
      message: "must have required property 'gross_charge'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0",
      field: "0",
      message: "must have required property 'discounted_cash'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/0",
      field: "0",
      message: "must have required property 'standard_charge_dollar'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/0",
      field: "0",
      message: "must have required property 'standard_charge_algorithm'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/0",
      field: "0",
      message: "must have required property 'standard_charge_percentage'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/0",
      field: "0",
      message: "must match a schema in anyOf",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0",
      field: "0",
      message: "must match a schema in anyOf",
    },
  ])

  const result3 = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-error-minimum.json"),
    "v2.0"
  )
  t.is(result3.valid, false)
  t.deepEqual(result3.errors.length, 7)
  t.is(result.alerts.length, 0)
  t.deepEqual(result3.errors, [
    {
      path: "/standard_charge_information/1/standard_charges/0",
      field: "0",
      message: "must have required property 'minimum'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0",
      field: "0",
      message: 'must match "then" schema',
    },
    {
      path: "/standard_charge_information/2/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charge_information/2/standard_charges/0",
      field: "0",
      message: 'must match "then" schema',
    },
    {
      path: "/standard_charge_information/3/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charge_information/3/standard_charges/0",
      field: "0",
      message: 'must match "then" schema',
    },
  ])
})

test("validateJson estimated amount conditional", async (t) => {
  const enforce2025 = new Date().getFullYear() >= 2025
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-error-estimate.json"),
    "v2.0"
  )
  t.is(result.valid, !enforce2025)
  t.is(result.errors.length, 2)
  t.is(result.alerts.length, 0)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
      field: "3",
      message: "must have required property 'estimated_amount'",
      ...(enforce2025 ? {} : { warning: true }),
    },
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
      field: "3",
      message: 'must match "then" schema',
      ...(enforce2025 ? {} : { warning: true }),
    },
  ])
})

test("validateJson NDC drug information conditional", async (t) => {
  const enforce2025 = new Date().getFullYear() >= 2025
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-error-ndc.json"),
    "v2.0"
  )
  t.is(result.valid, !enforce2025)
  t.is(result.errors.length, 2)
  t.is(result.alerts.length, 0)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0",
      field: "",
      message: "must have required property 'drug_information'",
      ...(enforce2025 ? {} : { warning: true }),
    },
    {
      path: "/standard_charge_information/0",
      field: "",
      message: 'must match "then" schema',
      ...(enforce2025 ? {} : { warning: true }),
    },
  ])
})

test("validateJson with incorrect code information property", async (t) => {
  const enforce2025 = new Date().getFullYear() >= 2025
  const result = await validateJson(
    loadFixtureStream(
      "/2.0/sample-conditional-error-wrong-code-information.json"
    ),
    "v2.0"
  )
  // always invalid due to missing code_information
  t.is(result.valid, false)
  // starting jan 1 2025, drug information is required when an NDC code is present
  if (enforce2025) {
    // the file contains no NDC codes, so no errors about requiring drug information should be present
    const drugInfoError = result.errors.findIndex((err) => {
      return err.message == "must have required property 'drug_information'"
    })
    t.is(drugInfoError, -1)
  }
})

test("validateJson 2025 properties", async (t) => {
  const enforce2025 = new Date().getFullYear() >= 2025
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-2025-properties.json"),
    "v2.0"
  )
  t.is(result.valid, !enforce2025)
  t.is(result.errors.length, 3)
  t.is(result.alerts.length, 0)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0/drug_information",
      field: "drug_information",
      message: "must have required property 'type'",
      ...(enforce2025 ? {} : { warning: true }),
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/1/estimated_amount",
      field: "estimated_amount",
      message: "must be number",
      ...(enforce2025 ? {} : { warning: true }),
    },
    {
      path: "/modifier_information/0",
      field: "0",
      message: "must have required property 'modifier_payer_information'",
      ...(enforce2025 ? {} : { warning: true }),
    },
  ])
})

test("validateJson minimum not required if there are no payer-specific standard charges", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-valid-minimum.json"),
    "v2.0"
  )
  t.is(result.valid, true)
})

test("collect alerts when estimated amount is nine 9s", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-nine-nines.json"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.is(result.errors.length, 0)
  t.is(result.alerts.length, 2)
  t.deepEqual(result.alerts, [
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/3/estimated_amount",
      field: "estimated_amount",
      message: "Nine 9s should not be used for estimated amount.",
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/1/estimated_amount",
      field: "estimated_amount",
      message: "Nine 9s should not be used for estimated amount.",
    },
  ])
})

test("collect alerts up to the maximum amount", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-nine-nines.json"),
    "v2.0",
    { maxErrors: 1 }
  )
  t.is(result.valid, true)
  t.is(result.errors.length, 0)
  t.is(result.alerts.length, 1)
  t.deepEqual(result.alerts, [
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/3/estimated_amount",
      field: "estimated_amount",
      message: "Nine 9s should not be used for estimated amount.",
    },
  ])
})
