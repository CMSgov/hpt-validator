import test from "ava"
import {
  validateHeaderColumns,
  validateHeaderRow,
  HEADER_COLUMNS,
} from "../../src/versions/2.0/csv.js"

const VALID_HEADER_COLUMNS = HEADER_COLUMNS.map((c) =>
  c === "license_number | state" ? "license_number | MD" : c
)

test("validateHeaderColumns", (t) => {
  const emptyResult = validateHeaderColumns([])
  t.is(emptyResult.errors.length, HEADER_COLUMNS.length)
  t.is(emptyResult.columns.length, 0)
  const basicResult = validateHeaderColumns(VALID_HEADER_COLUMNS)
  t.is(basicResult.errors.length, 0)
  t.deepEqual(basicResult.columns, VALID_HEADER_COLUMNS)
  const reversedColumns = [...VALID_HEADER_COLUMNS].reverse()
  const reverseResult = validateHeaderColumns(reversedColumns)
  t.is(reverseResult.errors.length, 0)
  t.deepEqual(reverseResult.columns, reversedColumns)
  const extraColumns = [
    "extra1",
    ...VALID_HEADER_COLUMNS.slice(0, 2),
    "extra2",
    ...VALID_HEADER_COLUMNS.slice(2),
  ]
  const extraResult = validateHeaderColumns(extraColumns)
  t.is(extraResult.errors.length, 0)
  t.deepEqual(extraResult.columns, [
    undefined,
    ...VALID_HEADER_COLUMNS.slice(0, 2),
    undefined,
    ...VALID_HEADER_COLUMNS.slice(2),
  ])
})

test("validateHeaderRow", (t) => {
  t.is(
    validateHeaderRow(VALID_HEADER_COLUMNS, []).length,
    VALID_HEADER_COLUMNS.length
  )
  t.is(
    validateHeaderRow(VALID_HEADER_COLUMNS, [
      "name",
      "2022-01-01",
      "1.0.0",
      "Woodlawn",
      "123 Address",
      "001 | MD",
      "true",
    ]).length,
    0
  )
  // last_updated_on must be a valid date
  const invalidDateResult = validateHeaderRow(VALID_HEADER_COLUMNS, [
    "name",
    "2022-14-01",
    "1.0.0",
    "Woodlawn",
    "123 Address",
    "001 | MD",
    "true",
  ])
  t.is(invalidDateResult.length, 1)
  t.assert(invalidDateResult[0].message.includes("not a valid YYYY-MM-DD date"))
  // affirmation must be true
  const wrongAffirmationResult = validateHeaderRow(VALID_HEADER_COLUMNS, [
    "name",
    "2022-01-01",
    "1.0.0",
    "Woodlawn",
    "123 Address",
    "001 | MD",
    "yes",
  ])
  t.is(wrongAffirmationResult.length, 1)
  t.assert(wrongAffirmationResult[0].message.includes("allowed value"))
})
