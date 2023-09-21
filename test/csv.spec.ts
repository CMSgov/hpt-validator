import test from "ava"
import {
  validateHeaderColumns,
  validateHeaderRow,
  validateWideColumns,
  validateColumns,
  validateTallFields,
  validateWideFields,
  getBaseColumns,
  getTallColumns,
  isTall,
  BASE_COLUMNS,
  MIN_MAX_COLUMNS,
  HEADER_COLUMNS,
  TALL_COLUMNS,
} from "../src/versions/1.1/csv.js"
import { CONTRACTING_METHODS } from "../src/versions/1.1/types.js"

const VALID_HEADER_COLUMNS = HEADER_COLUMNS.map((c) =>
  c === "license_number | state" ? "license_number | MD" : c
)

test("validateHeaderColumns", (t) => {
  t.is(validateHeaderColumns([]).length, HEADER_COLUMNS.length)
  t.deepEqual(validateHeaderColumns(VALID_HEADER_COLUMNS), [])
  t.is(
    validateHeaderColumns(VALID_HEADER_COLUMNS.slice(0, -1))[0].column,
    VALID_HEADER_COLUMNS.length - 1
  )
})

test("validateHeaderRow", (t) => {
  t.is(validateHeaderRow([]).length, 1)
  t.is(
    validateHeaderRow([
      "name",
      "2022-01-01",
      "1.0.0",
      "Woodlawn",
      "Aid",
      "001 | MD",
    ]).length,
    0
  )
  t.assert(
    validateHeaderRow([
      "",
      "2022-01-01",
      "1.0.0",
      "Woodlawn",
      "Aid",
      "001 | MD",
    ])[0].message.includes("blank")
  )
})

test("validateColumns tall", (t) => {
  t.is(
    validateColumns([
      ...getBaseColumns([
        "code | 1",
        "code| 1 | type",
        "code | 2",
        "code | 2 | type",
      ]),
      ...getTallColumns([]),
    ]).length,
    0
  )
  // Extra columns should be ignored
  t.is(
    validateColumns([
      ...getBaseColumns([
        "code | 1",
        "code | 1 |type",
        "code | 2",
        "code | 2 | type",
      ]),
      ...getTallColumns([]),
      "test",
    ]).length,
    0
  )
  const baseCols = getBaseColumns([
    "code | 1",
    "code | 1 | type",
    "code | 2",
    "code | 2 | type",
  ])
  t.is(
    validateColumns([
      ...baseCols.slice(0, baseCols.length - 1),
      ...getTallColumns([]),
      "test",
    ]).length,
    9
  )
})

test("validateWideColumns", (t) => {
  // Currently only checking for the order of additional_generic_notes
  t.is(
    validateWideColumns([
      ...BASE_COLUMNS,
      ...MIN_MAX_COLUMNS,
      "standard_charge | Payer | Plan",
      "additional_generic_notes",
      "standard_charge | Payer | Plan | pct",
    ]).length,
    1
  )
})

test("isTall", (t) => {
  t.assert(isTall([...BASE_COLUMNS, ...MIN_MAX_COLUMNS, ...TALL_COLUMNS]))
  t.assert(
    isTall([
      ...BASE_COLUMNS,
      ...MIN_MAX_COLUMNS,
      ...TALL_COLUMNS.slice(0, TALL_COLUMNS.length - 1),
      "test",
    ])
  )
  t.assert(
    !isTall([
      ...BASE_COLUMNS,
      "code | 1",
      "code | 1 | type",
      "code | 2",
      "code | 2| type",
      ...MIN_MAX_COLUMNS,
      ...TALL_COLUMNS.filter((c) => c !== "payer_name"),
    ])
  )
  t.assert(
    !isTall([
      ...BASE_COLUMNS,
      ...MIN_MAX_COLUMNS,
      "standard_charge | payer | plan",
      "standard_charge |payer | plan | percent",
      "standard_charge | payer | plan | contracting_method",
      "standard_charge | payer | plan",
      "standard_charge | payer | plan | percent",
      "additional_generic_notes",
    ])
  )
})

test("validateTallFields", (t) => {
  t.is(
    validateTallFields(
      {
        payer_name: "Payer",
        plan_name: "Plan",
        "standard_charge | negotiated_dollar": "1.0",
        "standard_charge | negotiated_percent": "",
        "standard_charge | contracting_method": CONTRACTING_METHODS[0],
        additional_generic_notes: "",
      },
      0
    ).length,
    0
  )
  t.is(
    validateTallFields(
      {
        payer_name: "Payer",
        plan_name: "Plan",
        "standard_charge | negotiated_dollar": "",
        "standard_charge | negotiated_percent": "",
        "standard_charge | contracting_method": CONTRACTING_METHODS[0],
        additional_generic_notes: "",
      },
      0
    ).length,
    2
  )
})

test("validateWideFields", (t) => {
  t.is(
    validateWideFields(
      {
        "standard_charge | payer | plan": "",
        "standard_charge | payer | plan | percent": "1.5",
        "standard_charge | payer | plan | contracting_method":
          CONTRACTING_METHODS[2],
        additional_generic_notes: "",
      },
      0
    ).length,
    0
  )
  t.is(
    validateWideFields(
      {
        "standard_charge | payer | plan": "",
        "standard_charge | payer | plan | percent": "",
        "standard_charge | payer | plan | contracting_method":
          CONTRACTING_METHODS[2],
        additional_generic_notes: "",
      },
      0
    ).length,
    1
  )
})
