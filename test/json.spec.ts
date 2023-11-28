import test from "ava"
import { loadFixtureStream } from "./utils"
import { validateJson } from "../src/json.js"

test("validateJson v1.1", async (t) => {
  const result = await validateJson(
    loadFixtureStream("1.1", "sample-1.json"),
    "v1.1"
  )
  t.is(result.valid, false)
  t.is(result.errors.length, 1)
})

test("validateJson v1.1 empty", async (t) => {
  const result = await validateJson(
    loadFixtureStream("1.1", "sample-empty.json"),
    "v1.1"
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 4)
})

test("validateJson v1.1 maxErrors", async (t) => {
  const result = await validateJson(
    loadFixtureStream("1.1", "sample-empty.json"),
    "v1.1",
    {
      maxErrors: 1,
    }
  )
  t.is(result.valid, false)
  t.deepEqual(result.errors.length, 1)
})

test("validateJson v1.1 valid", async (t) => {
  const result = await validateJson(
    loadFixtureStream("1.1", "sample-valid.json"),
    "v1.1"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})

test("validateJson v2.0 valid", async (t) => {
  const result = await validateJson(
    loadFixtureStream("2.0", "sample-valid.json"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})
