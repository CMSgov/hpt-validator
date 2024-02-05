import test from "ava"
import { validateCsv } from "../../src/csv.js"
import { loadFixtureStream } from "../utils.js"

test("validateCsvTall", async (t) => {
  const result = await validateCsv(
    loadFixtureStream("/2.0/sample-tall-valid.csv"),
    "v2.0"
  )
  t.is(result.valid, true)
  t.deepEqual(result.errors.length, 0)
})
