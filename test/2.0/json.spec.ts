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
})

test("validateJson empty", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-empty.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 8)
})

test("validateJson syntactically invalid", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-invalid.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 1)
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
})

test("validateJson errorFile", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-errors.json"),
    "v2.0"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 3)
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
      message: 'must match "else" schema',
    },
    {
      path: "/standard_charge_information/2/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charge_information/2/standard_charges/0",
      field: "0",
      message: 'must match "else" schema',
    },
    {
      path: "/standard_charge_information/3/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charge_information/3/standard_charges/0",
      field: "0",
      message: 'must match "else" schema',
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
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
      field: "3",
      message: "must have required property 'estimated_amount'",
      warning: enforce2025 ? undefined : true,
    },
    {
      path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
      field: "3",
      message: 'must match "then" schema',
      warning: enforce2025 ? undefined : true,
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
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0",
      field: "",
      message: "must have required property 'drug_information'",
      warning: enforce2025 ? undefined : true,
    },
    {
      path: "/standard_charge_information/0",
      field: "",
      message: 'must match "then" schema',
      warning: enforce2025 ? undefined : true,
    },
  ])
})

test("validateJson 2025 properties", async (t) => {
  const enforce2025 = new Date().getFullYear() >= 2025
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-2025-properties.json"),
    "v2.0"
  )
  t.is(result.valid, !enforce2025)
  t.is(result.errors.length, 3)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charge_information/0/drug_information",
      field: "drug_information",
      message: "must have required property 'type'",
      warning: enforce2025 ? undefined : true,
    },
    {
      path: "/standard_charge_information/1/standard_charges/0/payers_information/1/estimated_amount",
      field: "estimated_amount",
      message: "must be number",
      warning: enforce2025 ? undefined : true,
    },
    {
      path: "/modifier_information/0",
      field: "0",
      message: "must have required property 'modifier_payer_information'",
      warning: enforce2025 ? undefined : true,
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
