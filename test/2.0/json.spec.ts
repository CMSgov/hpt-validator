import test from "ava"
import { loadFixtureStream } from "../utils.js"
import { validateJson } from "../../src/json.js"

test("validateJson", async (t) => {
  const result = await validateJson(
    loadFixtureStream("/2.0/sample-valid.json"),
    "v2.0"
  )
  t.is(result.valid, true)
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
/*
test("validateJson valid", async (t) => {
  const result = await validateJson(
    loadFixtureStream("sample-valid.json"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})
*/