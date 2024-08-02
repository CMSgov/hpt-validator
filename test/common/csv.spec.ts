import test from "ava"
import { csvColumnName, matchesString } from "../../src/versions/common/csv.js"

test("csvColumnName", (t) => {
  t.is(csvColumnName(0), "A")
  t.is(csvColumnName(26), "AA")
  t.is(csvColumnName(702), "AAA")
  t.is(csvColumnName(18278), "AAAA")
  t.is(csvColumnName(475254), "AAAAA")
})

test("matchesString", (t) => {
  t.is(matchesString("testing", "testing"), true)
  t.is(matchesString("testing", "tresting"), false)
  t.is(matchesString(1 as unknown as string, "testing"), false)
  t.is(matchesString(undefined as unknown as string, "testing"), false)
})
