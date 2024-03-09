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
      path: "/standard_charges/0/payers_information/0/standard_charge_dollar",
      field: "standard_charge_dollar",
      message: "must be number",
    },
    {
      path: "/standard_charges/3/payers_information/2",
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
      path: "/standard_charges/3/payers_information/2",
      field: "2",
      message: "must have required property 'additional_payer_notes'",
    },
    {
      path: "/standard_charges/3/payers_information/2",
      field: "2",
      message: 'must match "then" schema',
    },
  ])

  const result2 = await validateJson(
    loadFixtureStream("/2.0/sample-conditional-error-standardcharge.json"),
    "v2.0"
  )
  t.is(result2.valid, false)
  t.deepEqual(result2.errors.length, 7)
  t.deepEqual(result2.errors, [
    {
      path: "/standard_charges/0",
      field: "0",
      message: "must have required property 'gross_charge'",
    },
    {
      path: "/standard_charges/0",
      field: "0",
      message: "must have required property 'discounted_cash'",
    },
    {
      path: "/standard_charges/1/payers_information/0",
      field: "0",
      message: "must have required property 'standard_charge_dollar'",
    },
    {
      path: "/standard_charges/1/payers_information/0",
      field: "0",
      message: "must have required property 'standard_charge_algorithm'",
    },
    {
      path: "/standard_charges/1/payers_information/0",
      field: "0",
      message: "must have required property 'standard_charge_percentage'",
    },
    {
      path: "/standard_charges/1/payers_information/0",
      field: "0",
      message: "must match a schema in anyOf",
    },
    {
      path: "/standard_charges/0",
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
      path: "/standard_charges/0",
      field: "0",
      message: "must have required property 'minimum'",
    },
    {
      path: "/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charges/0",
      field: "0",
      message: 'must match "else" schema',
    },
    {
      path: "/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charges/0",
      field: "0",
      message: 'must match "else" schema',
    },
    {
      path: "/standard_charges/0",
      field: "0",
      message: "must have required property 'maximum'",
    },
    {
      path: "/standard_charges/0",
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
  t.is(result.valid, true)
  t.is(result.errors.length, 2)
  t.deepEqual(result.errors, [
    {
      path: "/standard_charges/0/payers_information/3",
      field: "3",
      message: "must have required property 'estimated_amount'",
      warning: enforce2025 ? undefined : true,
    },
    {
      path: "/standard_charges/0/payers_information/3",
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
  t.is(result.valid, true)
  t.is(result.errors.length, 2)
  t.deepEqual(result.errors, [
    {
      path: "",
      field: "",
      message: "must have required property 'drug_information'",
      warning: enforce2025 ? undefined : true,
    },
    {
      path: "",
      field: "",
      message: 'must match "then" schema',
      warning: enforce2025 ? undefined : true,
    },
  ])
})
