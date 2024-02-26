import test from "ava"
import {
  validateHeaderColumns,
  validateHeaderRow,
  validateColumns,
  validateRow,
  HEADER_COLUMNS,
  BASE_COLUMNS,
  TALL_COLUMNS,
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
  const duplicateColumns = [...VALID_HEADER_COLUMNS, "hospital_location"]
  const duplicateResult = validateHeaderColumns(duplicateColumns)
  t.is(duplicateResult.errors.length, 1)
  t.is(
    duplicateResult.errors[0].message,
    "Column hospital_location duplicated in header"
  )
  t.deepEqual(duplicateResult.columns, VALID_HEADER_COLUMNS)
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

test("validateColumns tall", (t) => {
  const columns = [
    ...BASE_COLUMNS,
    ...TALL_COLUMNS,
    "code | 1",
    "code | 1 | type",
  ]
  t.is(validateColumns(columns).length, 0)
  // any order is okay
  const reverseColumns = [...columns].reverse()
  t.is(validateColumns(reverseColumns).length, 0)
  // extra code columns may appear
  const extraCodes = [
    ...columns,
    "code|2",
    "code|2|type",
    "code|3",
    "code|3|type",
  ]
  t.is(validateColumns(extraCodes).length, 0)
  // duplicates are not allowed
  const duplicateColumns = [...columns, "payer_name"]
  const duplicateErrors = validateColumns(duplicateColumns)
  t.is(duplicateErrors.length, 1)
  t.assert(
    duplicateErrors[0].message.includes('Column "payer_name" duplicated')
  )
  // if a column is missing, that's an error
  const missingBase = columns.slice(1)
  const missingBaseResult = validateColumns(missingBase)
  t.is(missingBaseResult.length, 1)
  t.assert(missingBaseResult[0].message.includes("description is missing"))
  // this also applies to code columns, where code|i means that code|i|type must appear
  const missingCode = [...columns, "code | 2"]
  const missingCodeResult = validateColumns(missingCode)
  t.is(missingCodeResult.length, 1)
  t.assert(missingCodeResult[0].message.includes("code | 2 | type is missing"))
  // code|i|type means that code|i must be present
  const missingType = [...columns, "code | 2 | type"]
  const missingTypeResult = validateColumns(missingType)
  t.is(missingTypeResult.length, 1)
  t.assert(missingTypeResult[0].message.includes("code | 2 is missing"))
})

test("validateRow tall", (t) => {
  const columns = [
    ...BASE_COLUMNS,
    ...TALL_COLUMNS,
    "code | 1",
    "code | 1 | type",
    "code | 2",
    "code | 2 | type",
  ]
  const basicRow = {
    description: "basic description",
    setting: "inpatient",
    "code | 1": "12345",
    "code | 1 | type": "DRG",
    "code | 2": "",
    "code | 2 | type": "",
    drug_unit_of_measurement: "8.5",
    drug_type_of_measurement: "ML",
    modifiers: "",
    "standard_charge | gross": "100",
    "standard_charge | discounted_cash": "200.50",
    "standard_charge | min": "50",
    "standard_charge | max": "500",
    additional_generic_notes: "some notes",
    payer_name: "Acme Payer",
    plan_name: "Acme Basic Coverage",
    "standard_charge | negotiated_dollar": "300",
    "standard_charge | negotiated_percentage": "",
    "standard_charge | negotiated_algorithm": "",
    "standard_charge | methodology": "fee schedule",
    estimated_amount: "",
  }
  const basicResult = validateRow(basicRow, 5, columns, false)
  t.is(basicResult.length, 0)
  // description must not be empty
  const noDescriptionRow = { ...basicRow, description: "" }
  const noDescriptionResult = validateRow(noDescriptionRow, 6, columns, false)
  t.is(noDescriptionResult.length, 1)
  t.assert(noDescriptionResult[0].message.includes('"description" is required'))
  // setting must not be empty
  const noSettingRow = { ...basicRow, setting: "" }
  const noSettingResult = validateRow(noSettingRow, 7, columns, false)
  t.is(noSettingResult.length, 1)
  t.assert(noSettingResult[0].message.includes('"setting" is required'))
  // setting must be one of CHARGE_SETTINGS
  const wrongSettingRow = { ...basicRow, setting: "everywhere" }
  const wrongSettingResult = validateRow(wrongSettingRow, 8, columns, false)
  t.is(wrongSettingResult.length, 1)
  t.assert(
    wrongSettingResult[0].message.includes(
      '"setting" value "everywhere" is not one of the allowed values'
    )
  )
  // drug_unit_of_measurement must be positive number if present
  const emptyDrugUnitRow = { ...basicRow, drug_unit_of_measurement: "" }
  const emptyDrugUnitResult = validateRow(emptyDrugUnitRow, 9, columns, false)
  t.is(emptyDrugUnitResult.length, 0)
  const wrongDrugUnitRow = { ...basicRow, drug_unit_of_measurement: "-4" }
  const wrongDrugUnitResult = validateRow(wrongDrugUnitRow, 10, columns, false)
  t.is(wrongDrugUnitResult.length, 1)
  t.assert(
    wrongDrugUnitResult[0].message.includes(
      '"drug_unit_of_measurement" value "-4" is not a valid positive number'
    )
  )
  // drug_type_of_measurement must be one of DRUG_UNITS if present
  const wrongDrugTypeRow = { ...basicRow, drug_type_of_measurement: "KG" }
  const wrongDrugTypeResult = validateRow(wrongDrugTypeRow, 12, columns, false)
  t.is(wrongDrugTypeResult.length, 1)
  t.assert(
    wrongDrugTypeResult[0].message.includes(
      '"drug_type_of_measurement" value "KG" is not one of the allowed values'
    )
  )
  // standard_charge | gross must be positive number if present
  const emptyGrossRow = { ...basicRow, "standard_charge | gross": "" }
  const emptyGrossResult = validateRow(emptyGrossRow, 13, columns, false)
  t.is(emptyGrossResult.length, 0)
  const wrongGrossRow = { ...basicRow, "standard_charge | gross": "3,000" }
  const wrongGrossResult = validateRow(wrongGrossRow, 14, columns, false)
  t.is(wrongGrossResult.length, 1)
  t.assert(
    wrongGrossResult[0].message.includes(
      '"standard_charge | gross" value "3,000" is not a valid positive number'
    )
  )
  // standard_charge | discounted_cash must be positive number if present
  const emptyDiscountedRow = {
    ...basicRow,
    "standard_charge | discounted_cash": "",
  }
  const emptyDiscountedResult = validateRow(
    emptyDiscountedRow,
    15,
    columns,
    false
  )
  t.is(emptyDiscountedResult.length, 0)
  const wrongDiscountedRow = {
    ...basicRow,
    "standard_charge | discounted_cash": "300.25.1",
  }
  const wrongDiscountedResult = validateRow(
    wrongDiscountedRow,
    16,
    columns,
    false
  )
  t.is(wrongDiscountedResult.length, 1)
  t.assert(
    wrongDiscountedResult[0].message.includes(
      '"standard_charge | discounted_cash" value "300.25.1" is not a valid positive number'
    )
  )
  // standard_charge | min must be positive number if present
  const emptyMinRow = { ...basicRow, "standard_charge | min": "" }
  const emptyMinResult = validateRow(emptyMinRow, 17, columns, false)
  t.is(emptyMinResult.length, 0)
  const wrongMinRow = {
    ...basicRow,
    "standard_charge | min": "-5",
  }
  const wrongMinResult = validateRow(wrongMinRow, 18, columns, false)
  t.is(wrongMinResult.length, 1)
  t.assert(
    wrongMinResult[0].message.includes(
      '"standard_charge | min" value "-5" is not a valid positive number'
    )
  )
  // standard_charge | max must be positive number if present
  const emptyMaxRow = { ...basicRow, "standard_charge | max": "" }
  const emptyMaxResult = validateRow(emptyMaxRow, 19, columns, false)
  t.is(emptyMaxResult.length, 0)
  const wrongMaxRow = {
    ...basicRow,
    "standard_charge | max": "-2",
  }
  const wrongMaxResult = validateRow(wrongMaxRow, 20, columns, false)
  t.is(wrongMaxResult.length, 1)
  t.assert(
    wrongMaxResult[0].message.includes(
      '"standard_charge | max" value "-2" is not a valid positive number'
    )
  )
  // no code pairs is invalid
  const noCodesRow = { ...basicRow, "code | 1": "", "code | 1 | type": "" }
  const noCodesResult = validateRow(noCodesRow, 21, columns, false)
  t.is(noCodesResult.length, 1)
  t.assert(
    noCodesResult[0].message.includes(
      "At least one code and code type must be specified"
    )
  )
  // a code pair not in the first column is valid
  const secondCodeRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    "code | 2": "234",
    "code | 2 | type": "LOCAL",
  }
  const secondCodeResult = validateRow(secondCodeRow, 22, columns, false)
  t.is(secondCodeResult.length, 0)
  // a code without a code type is invalid
  const noTypeRow = { ...basicRow, "code | 1 | type": "" }
  const noTypeResult = validateRow(noTypeRow, 23, columns, false)
  t.is(noTypeResult.length, 1)
  t.assert(
    noTypeResult[0].message.includes(
      '"code | 1 | type" is required' // should this be a unique message instead?
    )
  )
  // a code type without a code is invalid
  const onlyTypeRow = { ...basicRow, "code | 1": "" }
  const onlyTypeResult = validateRow(onlyTypeRow, 24, columns, false)
  t.is(onlyTypeResult.length, 1)
  t.assert(
    onlyTypeResult[0].message.includes(
      '"code | 1" is required' // should this be a unique message instead?
    )
  )
  // a code type must be one of BILLING_CODE_TYPES
  const wrongTypeRow = { ...basicRow, "code | 1 | type": "GUS" }
  const wrongTypeResult = validateRow(wrongTypeRow, 25, columns, false)
  t.is(wrongTypeResult.length, 1)
  t.assert(
    wrongTypeResult[0].message.includes(
      '"code | 1 | type" value "GUS" is not one of the allowed values'
    )
  )
})
