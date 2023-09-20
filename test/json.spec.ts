import test from "ava"
import { loadFixtureStream, loadFixture } from "./utils"
import { validateJson, validateJsonSync } from "../src/json.js"

test("validateJson", async (t) => {
  const result = await validateJson(loadFixtureStream("sample-1.json"))
  t.is(result.valid, false)
  t.is(result.errors.length, 1)
})

test("validateJson empty", async (t) => {
  const result = await validateJson(loadFixtureStream("sample-empty.json"))
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 4)
})

test("validateJson maxErrors", async (t) => {
  const result = await validateJson(loadFixtureStream("sample-empty.json"), {
    maxErrors: 1,
  })
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 1)
})

test("validateJson valid", async (t) => {
  const result = await validateJson(loadFixtureStream("sample-valid.json"))
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})

test("validateJsonSync", (t) => {
  const result = validateJsonSync(loadFixture("sample-1.json"))
  t.is(result.valid, false)
  t.is(result.errors.length, 1)
})

test("validateJsonSync empty", (t) => {
  const result = validateJsonSync(loadFixture("sample-empty.json"))
  t.is(result.valid, false)
  t.is(result.errors.length, 4)
})

test("validateJsonSync valid", (t) => {
  const result = validateJsonSync(loadFixture("sample-valid.json"))
  t.is(result.valid, true)
  t.is(result.errors.length, 0)
})
