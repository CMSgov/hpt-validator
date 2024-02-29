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
  c === "license_number | [state]" ? "license_number | MD" : c
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
  const invalidStateColumns = HEADER_COLUMNS.map((c) =>
    c === "license_number | [state]" ? "license_number | ZZ" : c
  )
  const invalidStateErrors = validateHeaderColumns(invalidStateColumns)
  t.is(invalidStateErrors.errors.length, 2)
  t.assert(
    invalidStateErrors.errors[0].message.includes(
      "ZZ is not an allowed value for state abbreviation"
    )
  )
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
  const emptyMinRow = {
    ...basicRow,
    "standard_charge | min": "",
    "standard_charge | negotiated_dollar": "",
    "standard_charge | negotiated_percentage": "80",
    estimated_amount: "150",
  }
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
  const emptyMaxRow = {
    ...basicRow,
    "standard_charge | max": "",
    "standard_charge | negotiated_dollar": "",
    "standard_charge | negotiated_percentage": "80",
    estimated_amount: "250",
  }
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

test("validateRow tall conditionals", (t) => {
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
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
    modifiers: "",
    "standard_charge | gross": "100",
    "standard_charge | discounted_cash": "200.50",
    "standard_charge | min": "50",
    "standard_charge | max": "500",
    additional_generic_notes: "",
    payer_name: "Acme Payer",
    plan_name: "Acme Basic Coverage",
    "standard_charge | negotiated_dollar": "",
    "standard_charge | negotiated_percentage": "",
    "standard_charge | negotiated_algorithm": "",
    "standard_charge | methodology": "fee schedule",
    estimated_amount: "",
  }

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  const dollarNoBoundsRow = {
    ...basicRow,
    "standard_charge | negotiated_dollar": "300",
    "standard_charge | min": "",
    "standard_charge | max": "",
  }
  const dollarNoBoundsErrors = validateRow(dollarNoBoundsRow, 5, columns, false)
  t.is(dollarNoBoundsErrors.length, 2)
  t.assert(
    dollarNoBoundsErrors[0].message.includes(
      '"standard_charge | min" is required when a negotiated dollar amount is present'
    )
  )
  t.assert(
    dollarNoBoundsErrors[1].message.includes(
      '"standard_charge | max" is required when a negotiated dollar amount is present'
    )
  )
  const percentageNoBoundsRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "80",
    "standard_charge | min": "",
    "standard_charge | max": "",
    estimated_amount: "160",
  }
  const percentageNoBoundsErrors = validateRow(
    percentageNoBoundsRow,
    6,
    columns,
    false
  )
  t.is(percentageNoBoundsErrors.length, 0)
  const algorithmNoBoundsRow = {
    ...basicRow,
    "standard_charge | negotiated_algorithm": "standard logarithm table",
    "standard_charge | min": "",
    "standard_charge | max": "",
    estimated_amount: "160",
  }
  const algorithmNoBoundsErrors = validateRow(
    algorithmNoBoundsRow,
    7,
    columns,
    false
  )
  t.is(algorithmNoBoundsErrors.length, 0)

  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.
  const enforceConditionals = new Date().getFullYear() >= 2025
  const percentageWithEstimateRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "80",
    estimated_amount: "150",
  }
  const percentageWithEstimateErrors = validateRow(
    percentageWithEstimateRow,
    8,
    columns,
    false
  )
  t.is(percentageWithEstimateErrors.length, 0)
  const percentageNoEstimateRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "80",
    estimated_amount: "",
  }
  const percentageNoEstimateErrors = validateRow(
    percentageNoEstimateRow,
    9,
    columns,
    false
  )
  t.is(percentageNoEstimateErrors.length, 1)
  t.assert(
    percentageNoEstimateErrors[0].message.includes(
      '"estimated_amount" is required to be a positive number when a negotiated percentage or algorithm is present, but negotiated dollar is not present'
    )
  )
  t.is(percentageNoEstimateErrors[0].warning, !enforceConditionals)
  const algorithmWithEstimateRow = {
    ...basicRow,
    "standard_charge | negotiated_algorithm": "standard logarithm table",
    estimated_amount: "150",
  }
  const algorithmWithEstimateErrors = validateRow(
    algorithmWithEstimateRow,
    10,
    columns,
    false
  )
  t.is(algorithmWithEstimateErrors.length, 0)
  const algorithmNoEstimateRow = {
    ...basicRow,
    "standard_charge | negotiated_algorithm": "standard logarithm table",
    estimated_amount: "",
  }
  const algorithmNoEstimateErrors = validateRow(
    algorithmNoEstimateRow,
    11,
    columns,
    false
  )
  t.is(algorithmNoEstimateErrors.length, 1)
  t.assert(
    algorithmNoEstimateErrors[0].message.includes(
      '"estimated_amount" is required to be a positive number when a negotiated percentage or algorithm is present, but negotiated dollar is not present'
    )
  )
  t.is(algorithmNoEstimateErrors[0].warning, !enforceConditionals)

  // If code type is NDC, then the corresponding drug unit of measure and
  // drug type of measure data elements must be encoded. Required beginning 1/1/2025.
  const ndcNoMeasurementRow = {
    ...basicRow,
    "code | 1 | type": "NDC",
    "standard_charge | negotiated_dollar": "300",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
  }
  const ndcNoMeasurementErrors = validateRow(
    ndcNoMeasurementRow,
    12,
    columns,
    false
  )
  t.is(ndcNoMeasurementErrors.length, 2)
  t.assert(
    ndcNoMeasurementErrors[0].message.includes(
      '"drug_unit_of_measurement" is required when an NDC code is present'
    )
  )
  t.assert(
    ndcNoMeasurementErrors[1].message.includes(
      '"drug_type_of_measurement" is required when an NDC code is present'
    )
  )
  t.is(ndcNoMeasurementErrors[0].warning, !enforceConditionals)
  t.is(ndcNoMeasurementErrors[1].warning, !enforceConditionals)
  const ndcSecondNoMeasurementRow = {
    ...basicRow,
    "code | 2": "12345",
    "code | 2 | type": "NDC",
    "standard_charge | negotiated_dollar": "300",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
  }
  const ndcSecondNoMeasurementErrors = validateRow(
    ndcSecondNoMeasurementRow,
    13,
    columns,
    false
  )
  t.is(ndcSecondNoMeasurementErrors.length, 2)
  t.assert(
    ndcSecondNoMeasurementErrors[0].message.includes(
      '"drug_unit_of_measurement" is required when an NDC code is present'
    )
  )
  t.assert(
    ndcSecondNoMeasurementErrors[1].message.includes(
      '"drug_type_of_measurement" is required when an NDC code is present'
    )
  )
  t.is(ndcSecondNoMeasurementErrors[0].warning, !enforceConditionals)
  t.is(ndcSecondNoMeasurementErrors[1].warning, !enforceConditionals)
  // If a modifier is encoded without an item or service, then a description and one of the following
  // is the minimum information required:
  // additional_generic_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm
  const invalidModifierRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
  }
  const invalidModifierErrors = validateRow(
    invalidModifierRow,
    14,
    columns,
    false
  )
  t.is(invalidModifierErrors.length, 1)
  t.assert(
    invalidModifierErrors[0].message.includes(
      'at least one of "additional_generic_notes", "standard_charge | negotiated_dollar", "standard_charge | negotiated_percentage", "standard_charge | negotiated_algorithm" is required for tall format when a modifier is encoded without an item or service'
    )
  )
  const modifierWithNotesRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    additional_generic_notes: "useful notes about the modifier",
  }
  const modifierWithNotesErrors = validateRow(
    modifierWithNotesRow,
    15,
    columns,
    false
  )
  t.is(modifierWithNotesErrors.length, 0)
  const modifierWithDollarRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | negotiated_dollar": "380",
  }
  const modifierWithDollarErrors = validateRow(
    modifierWithDollarRow,
    16,
    columns,
    false
  )
  t.is(modifierWithDollarErrors.length, 0)
  const modifierWithPercentageRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | negotiated_percentage": "48.5",
    estimated_amount: "150",
  }
  const modifierWithPercentageErrors = validateRow(
    modifierWithPercentageRow,
    17,
    columns,
    false
  )
  t.is(modifierWithPercentageErrors.length, 0)
  const modifierWithAlgorithmRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | negotiated_algorithm": "sliding function",
    estimated_amount: "150",
  }
  const modifierWithAlgorithmErrors = validateRow(
    modifierWithAlgorithmRow,
    18,
    columns,
    false
  )
  t.is(modifierWithAlgorithmErrors.length, 0)
  // types are still enforced for a modifier row
  const modifierWithWrongTypesRow = {
    ...basicRow,
    "standard_charge | negotiated_dollar": "$100",
    "standard_charge | negotiated_percentage": "15%",
    "standard_charge | methodology": "secret",
  }
  const modifierWithWrongTypesErrors = validateRow(
    modifierWithWrongTypesRow,
    19,
    columns,
    false
  )
  t.is(modifierWithWrongTypesErrors.length, 3)
  t.assert(
    modifierWithWrongTypesErrors[0].message.includes(
      '"standard_charge | negotiated_dollar" value "$100" is not a valid positive number'
    )
  )
  t.assert(
    modifierWithWrongTypesErrors[1].message.includes(
      '"standard_charge | negotiated_percentage" value "15%" is not a valid positive number'
    )
  )
  t.assert(
    modifierWithWrongTypesErrors[2].message.includes(
      '"standard_charge | methodology" value "secret" is not one of the allowed values'
    )
  )
})

test("validateRow wide conditionals", (t) => {
  const columns = [
    ...BASE_COLUMNS,
    "code | 1",
    "code | 1 | type",
    "code | 2",
    "code | 2 | type",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage",
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm",
    "estimated_amount | Payer One | Basic Plan",
    "standard_charge | Payer One | Basic Plan | methodology",
    "additional_payer_notes | Payer One | Basic Plan",
    "standard_charge | Payer Two | Special Plan | negotiated_dollar",
    "standard_charge | Payer Two | Special Plan | negotiated_percentage",
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm",
    "estimated_amount | Payer Two | Special Plan",
    "standard_charge | Payer Two | Special Plan | methodology",
    "additional_payer_notes | Payer Two | Special Plan",
  ]
  const basicRow = {
    description: "basic description",
    setting: "inpatient",
    "code | 1": "12345",
    "code | 1 | type": "DRG",
    "code | 2": "",
    "code | 2 | type": "",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
    modifiers: "",
    "standard_charge | gross": "100",
    "standard_charge | discounted_cash": "200.50",
    "standard_charge | min": "50",
    "standard_charge | max": "500",
    additional_generic_notes: "",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "",
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm": "",
    "estimated_amount | Payer One | Basic Plan": "",
    "standard_charge | Payer One | Basic Plan | methodology": "",
    "additional_payer_notes | Payer One | Basic Plan": "",
    "standard_charge | Payer Two | Special Plan | negotiated_dollar": "",
    "standard_charge | Payer Two | Special Plan | negotiated_percentage": "",
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm": "",
    "estimated_amount | Payer Two | Special Plan": "",
    "standard_charge | Payer Two | Special Plan | methodology": "",
    "additional_payer_notes | Payer Two | Special Plan": "",
  }
  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  const dollarNoBoundsRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "300",
    "standard_charge | min": "",
    "standard_charge | max": "",
  }
  const dollarNoBoundsErrors = validateRow(dollarNoBoundsRow, 5, columns, true)
  t.is(dollarNoBoundsErrors.length, 2)
  t.assert(
    dollarNoBoundsErrors[0].message.includes(
      '"standard_charge | min" is required when a negotiated dollar amount is present'
    )
  )
  t.assert(
    dollarNoBoundsErrors[1].message.includes(
      '"standard_charge | max" is required when a negotiated dollar amount is present'
    )
  )
  const percentageNoBoundsRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "standard_charge | min": "",
    "standard_charge | max": "",
    "estimated_amount | Payer One | Basic Plan": "160",
  }
  const percentageNoBoundsErrors = validateRow(
    percentageNoBoundsRow,
    6,
    columns,
    true
  )
  t.is(percentageNoBoundsErrors.length, 0)
  const algorithmNoBoundsRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm":
      "standard logarithm table",
    "standard_charge | min": "",
    "standard_charge | max": "",
    "estimated_amount | Payer One | Basic Plan": "160",
  }
  const algorithmNoBoundsErrors = validateRow(
    algorithmNoBoundsRow,
    7,
    columns,
    true
  )
  t.is(algorithmNoBoundsErrors.length, 0)

  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.
  const enforceConditionals = new Date().getFullYear() >= 2025

  const percentageWithEstimateRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "estimated_amount | Payer One | Basic Plan": "160",
  }
  const percentageWithEstimateErrors = validateRow(
    percentageWithEstimateRow,
    8,
    columns,
    true
  )
  t.is(percentageWithEstimateErrors.length, 0)
  const percentageNoEstimateRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
  }
  const percentageNoEstimateErrors = validateRow(
    percentageNoEstimateRow,
    9,
    columns,
    true
  )
  t.is(percentageNoEstimateErrors.length, 1)
  t.assert(
    percentageNoEstimateErrors[0].message.includes(
      '"estimated_amount | Payer One | Basic Plan" is required to be a positive number when a negotiated percentage or algorithm is present, but negotiated dollar is not present'
    )
  )
  t.is(percentageNoEstimateErrors[0].warning, !enforceConditionals)
  const percentageWrongEstimateRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "estimated_amount | Payer Two | Special Plan": "55",
  }
  const percentageWrongEstimateErrors = validateRow(
    percentageWrongEstimateRow,
    10,
    columns,
    true
  )
  t.is(percentageWrongEstimateErrors.length, 1)
  t.assert(
    percentageWrongEstimateErrors[0].message.includes(
      '"estimated_amount | Payer One | Basic Plan" is required to be a positive number when a negotiated percentage or algorithm is present, but negotiated dollar is not present'
    )
  )
  t.is(percentageWrongEstimateErrors[0].warning, !enforceConditionals)
  const algorithmWithEstimateRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm":
      "useful function",
    "estimated_amount | Payer Two | Special Plan": "55",
  }
  const algorithmWithEstimateErrors = validateRow(
    algorithmWithEstimateRow,
    11,
    columns,
    true
  )
  t.is(algorithmWithEstimateErrors.length, 0)
  const algorithmNoEstimateRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm":
      "useful function",
  }
  const algorithmNoEstimateErrors = validateRow(
    algorithmNoEstimateRow,
    12,
    columns,
    true
  )
  t.is(algorithmNoEstimateErrors.length, 1)
  t.assert(
    algorithmNoEstimateErrors[0].message.includes(
      '"estimated_amount | Payer Two | Special Plan" is required to be a positive number when a negotiated percentage or algorithm is present, but negotiated dollar is not present'
    )
  )
  t.is(algorithmNoEstimateErrors[0].warning, !enforceConditionals)
  const algorithmWrongEstimateRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm":
      "useful function",
    "estimated_amount | Payer One | Basic Plan": "55",
  }
  const algorithmWrongEstimateErrors = validateRow(
    algorithmWrongEstimateRow,
    13,
    columns,
    true
  )
  t.is(algorithmWrongEstimateErrors.length, 1)
  t.assert(
    algorithmWrongEstimateErrors[0].message.includes(
      '"estimated_amount | Payer Two | Special Plan" is required to be a positive number when a negotiated percentage or algorithm is present, but negotiated dollar is not present'
    )
  )
  t.is(algorithmWrongEstimateErrors[0].warning, !enforceConditionals)

  // If code type is NDC, then the corresponding drug unit of measure and
  // drug type of measure data elements must be encoded. Required beginning 1/1/2025.
  const ndcNoMeasurementRow = {
    ...basicRow,
    "code | 1 | type": "NDC",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "300",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
  }
  const ndcNoMeasurementErrors = validateRow(
    ndcNoMeasurementRow,
    14,
    columns,
    true
  )
  t.is(ndcNoMeasurementErrors.length, 2)
  t.assert(
    ndcNoMeasurementErrors[0].message.includes(
      '"drug_unit_of_measurement" is required when an NDC code is present'
    )
  )
  t.assert(
    ndcNoMeasurementErrors[1].message.includes(
      '"drug_type_of_measurement" is required when an NDC code is present'
    )
  )
  t.is(ndcNoMeasurementErrors[0].warning, !enforceConditionals)
  t.is(ndcNoMeasurementErrors[1].warning, !enforceConditionals)
  const ndcSecondNoMeasurementRow = {
    ...basicRow,
    "code | 2": "12345",
    "code | 2 | type": "NDC",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "300",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
  }
  const ndcSecondNoMeasurementErrors = validateRow(
    ndcSecondNoMeasurementRow,
    15,
    columns,
    true
  )
  t.is(ndcSecondNoMeasurementErrors.length, 2)
  t.assert(
    ndcSecondNoMeasurementErrors[0].message.includes(
      '"drug_unit_of_measurement" is required when an NDC code is present'
    )
  )
  t.assert(
    ndcSecondNoMeasurementErrors[1].message.includes(
      '"drug_type_of_measurement" is required when an NDC code is present'
    )
  )
  t.is(ndcSecondNoMeasurementErrors[0].warning, !enforceConditionals)
  t.is(ndcSecondNoMeasurementErrors[1].warning, !enforceConditionals)

  // If a modifier is encoded without an item or service, then a description and one of the following
  // is the minimum information required:
  // additional_generic_notes, additional_payer_notes, standard_charge | negotiated_dollar,
  // standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm
  const invalidModifierRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
  }
  const invalidModifierErrors = validateRow(
    invalidModifierRow,
    16,
    columns,
    true
  )
  t.is(invalidModifierErrors.length, 1)
  t.assert(
    invalidModifierErrors[0].message.includes(
      'at least one of "additional_generic_notes", "standard_charge | Payer One | Basic Plan | negotiated_dollar", "standard_charge | Payer One | Basic Plan | negotiated_percentage", "standard_charge | Payer One | Basic Plan | negotiated_algorithm", "additional_payer_notes | Payer One | Basic Plan", "standard_charge | Payer Two | Special Plan | negotiated_dollar", "standard_charge | Payer Two | Special Plan | negotiated_percentage", "standard_charge | Payer Two | Special Plan | negotiated_algorithm", "additional_payer_notes | Payer Two | Special Plan" is required for wide format when a modifier is encoded without an item or service'
    )
  )
  const modifierWithGenericNotesRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    additional_generic_notes: "useful notes about the modifier",
  }
  const modifierWithGenericNotesErrors = validateRow(
    modifierWithGenericNotesRow,
    17,
    columns,
    true
  )
  t.is(modifierWithGenericNotesErrors.length, 0)
  const modifierWithPayerNotesRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "additional_payer_notes | Payer One | Basic Plan":
      "useful notes for this payer",
  }
  const modifierWithPayerNotesErrors = validateRow(
    modifierWithPayerNotesRow,
    18,
    columns,
    true
  )
  t.is(modifierWithPayerNotesErrors.length, 0)
  const modifierWithDollarRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | Payer Two | Special Plan | negotiated_dollar": "151",
  }
  const modifierWithDollarErrors = validateRow(
    modifierWithDollarRow,
    19,
    columns,
    true
  )
  t.is(modifierWithDollarErrors.length, 0)
  const modifierWithPercentageRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "110",
  }
  const modifierWithPercentageErrors = validateRow(
    modifierWithPercentageRow,
    20,
    columns,
    true
  )
  t.is(modifierWithPercentageErrors.length, 0)
  const modifierWithAlgorithmRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm":
      "consult the table of numbers",
  }
  const modifierWithAlgorithmErrors = validateRow(
    modifierWithAlgorithmRow,
    21,
    columns,
    true
  )
  t.is(modifierWithAlgorithmErrors.length, 0)
  // types are still enforced for a modifier row
  const modifierWithWrongTypesRow = {
    ...basicRow,
    "code | 1": "",
    "code | 1 | type": "",
    modifiers: "50",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "$100",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "15%",
    "standard_charge | Payer Two | Special Plan | methodology": "secret",
  }
  const modifierWithWrongTypesErrors = validateRow(
    modifierWithWrongTypesRow,
    22,
    columns,
    true
  )
  t.is(modifierWithWrongTypesErrors.length, 3)
  t.assert(
    modifierWithWrongTypesErrors[0].message.includes(
      '"standard_charge | Payer One | Basic Plan | negotiated_dollar" value "$100" is not a valid positive number'
    )
  )
  t.assert(
    modifierWithWrongTypesErrors[1].message.includes(
      '"standard_charge | Payer One | Basic Plan | negotiated_percentage" value "15%" is not a valid positive number'
    )
  )
  t.assert(
    modifierWithWrongTypesErrors[2].message.includes(
      '"standard_charge | Payer Two | Special Plan | methodology" value "secret" is not one of the allowed values'
    )
  )
})
