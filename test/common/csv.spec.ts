import test from "ava"
import { csvColumnName } from "../../src/versions/common/csv.js"

test("csvColumnName", (t) => {
  t.is(csvColumnName(0), "A")
  t.is(csvColumnName(26), "AA")
})
