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
  console.log(result.errors)
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
