import test from "ava"
import {
  validateHeaderColumns,
  validateHeaderRow,
  validateColumns,
  validateRow,
  isAmbiguousFormat,
  HEADER_COLUMNS,
  BASE_COLUMNS,
  TALL_COLUMNS,
  NEW_2025_COLUMNS,
  collectAlerts,
} from "../../src/versions/2.0/csv.js"

const VALID_HEADER_COLUMNS = HEADER_COLUMNS.map((c) =>
  c === "license_number | [state]" ? "license_number | MD" : c
)

test("validateHeaderColumns", (t) => {
  const emptyResult = validateHeaderColumns([])
  t.is(emptyResult.errors.length, HEADER_COLUMNS.length)
  t.is(emptyResult.columns.length, 0)
  t.is(
    emptyResult.errors[0].message,
    'Header column "hospital_name" is miscoded or missing. You must include this header and confirm that it is encoded as specified in the data dictionary.'
  )
  const enforce2025 = new Date().getFullYear() >= 2025
  emptyResult.errors.forEach((err) => {
    if (NEW_2025_COLUMNS.includes(err.field || "")) {
      t.assert(!!err.warning === enforce2025)
    } else {
      t.assert(err.warning == null)
    }
  })

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
    "Column hospital_location duplicated in header. You must review and revise your column headers so that each header appears only once in the first row."
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
    VALID_HEADER_COLUMNS.length - 1
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
  // leading and trailing spaces are allowed, and comparisons are not case-sensitive
  t.is(
    validateHeaderRow(VALID_HEADER_COLUMNS, [
      "name",
      "2022-01-01",
      "1.0.0",
      "Woodlawn",
      "123 Address",
      "001 | MD",
      " TRUE ",
    ]).length,
    0
  )
  const missingNameErrors = validateHeaderRow(VALID_HEADER_COLUMNS, [
    "",
    "2022-01-01",
    "1.0.0",
    "Woodlawn",
    "123 Address",
    "001 | MD",
    "true",
  ])
  t.is(missingNameErrors.length, 1)
  t.is(
    missingNameErrors[0].message,
    'A value is required for "hospital_name". You must encode the missing information.'
  )

  const missingLicenseNumberValid = validateHeaderRow(VALID_HEADER_COLUMNS, [
    "name",
    "2022-01-01",
    "1.0.0",
    "Woodlawn",
    "123 Address",
    "",
    "true",
  ])
  t.is(missingLicenseNumberValid.length, 0)

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
  t.is(
    invalidDateResult[0].message,
    '"last_updated_on" value "2022-14-01" is not in a valid format. You must encode the date using the ISO 8601 format: YYYY-MM-DD or the month/day/year format: MM/DD/YYYY, M/D/YYYY'
  )
  // last_updated_on is allowed to be MM/DD/YYYY
  const dateResult1 = validateHeaderRow(VALID_HEADER_COLUMNS, [
    "name",
    "01/07/2024",
    "1.0.0",
    "Woodlawn",
    "123 Address",
    "001 | MD",
    "true",
  ])
  t.is(dateResult1.length, 0)
  // last_updated_on is allowed to be M/D/YYYY
  const dateResult2 = validateHeaderRow(VALID_HEADER_COLUMNS, [
    "name",
    "1/7/2024",
    "1.0.0",
    "Woodlawn",
    "123 Address",
    "001 | MD",
    "true",
  ])
  t.is(dateResult2.length, 0)
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
  t.is(
    wrongAffirmationResult[0].message,
    '"To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated." value "yes" is not one of the allowed valid values. You must encode one of these valid values: true, false'
  )
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
  t.is(
    duplicateErrors[0].message,
    "Column payer_name duplicated in header. You must review and revise your column headers so that each header appears only once in the third row."
  )
  // if a column is missing, that's an error
  const missingBase = columns.slice(1)
  const missingBaseResult = validateColumns(missingBase)
  t.is(missingBaseResult.length, 1)
  t.is(
    missingBaseResult[0].message,
    "Column description is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary."
  )
  // this also applies to code columns, where code|i means that code|i|type must appear
  const missingCode = [...columns, "code | 2"]
  const missingCodeResult = validateColumns(missingCode)
  t.is(missingCodeResult.length, 1)
  t.is(
    missingCodeResult[0].message,
    "Column code | 2 | type is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary."
  )
  // code|i|type means that code|i must be present
  const missingType = [...columns, "code | 2 | type"]
  const missingTypeResult = validateColumns(missingType)
  t.is(missingTypeResult.length, 1)
  t.is(
    missingTypeResult[0].message,
    "Column code | 2 is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary."
  )
})

test("isAmbiguousFormat", (t) => {
  const columnsTall = [
    ...BASE_COLUMNS,
    ...TALL_COLUMNS,
    "code | 1",
    "code | 1 | type",
    "code | 2",
    "code | 2 | type",
  ]

  const columnsWide = [
    ...BASE_COLUMNS,
    "code | 1",
    "code | 1 | type",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage",
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm",
    "standard_charge | Payer One | Basic Plan | methodology",
    "estimated_amount | Payer One | Basic Plan",
    "additional_payer_notes | Payer One | Basic Plan",
  ]

  const columnsAmbiguous1 = [...BASE_COLUMNS, "code | 1", "code | 1 | type"]
  const columnsAmbiguous2 = [...columnsWide, ...TALL_COLUMNS]

  const basicResultTall = isAmbiguousFormat(columnsTall)
  t.is(basicResultTall, false)

  const basicResultWide = isAmbiguousFormat(columnsWide)
  t.is(basicResultWide, false)

  const basicResultAmbiguous1 = isAmbiguousFormat(columnsAmbiguous1)
  t.is(basicResultAmbiguous1, true)

  const basicResultAmbiguous2 = isAmbiguousFormat(columnsAmbiguous2)
  t.is(basicResultAmbiguous2, true)

  const basicResultAmbiguousError1 = validateColumns(columnsAmbiguous1)
  t.is(basicResultAmbiguousError1.length, 1)
  t.is(
    basicResultAmbiguousError1[0].message,
    "Required payer-specific information data element headers are missing or miscoded from the MRF that does not follow the specifications for the CSV “Tall” or CSV “Wide” format."
  )
  // the ambiguous row error is always in row 3 of the csv
  // but csv rows are 1-indexed, and error rows are 0-indexed, so we expect 2
  t.is(basicResultAmbiguousError1[0].row, 2)

  const basicResultAmbiguousError2 = validateColumns(columnsAmbiguous2)
  t.is(basicResultAmbiguousError2.length, 1)
  t.is(
    basicResultAmbiguousError2[0].message,
    "Required payer-specific information data element headers are missing or miscoded from the MRF that does not follow the specifications for the CSV “Tall” or CSV “Wide” format."
  )
  t.is(basicResultAmbiguousError2[0].row, 2)
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
  const enforce2025 = new Date().getFullYear() >= 2025
  const basicResult = validateRow(basicRow, 5, columns, false)
  t.is(basicResult.length, 0)
  // description must not be empty
  const noDescriptionRow = { ...basicRow, description: "" }
  const noDescriptionResult = validateRow(noDescriptionRow, 6, columns, false)
  t.is(noDescriptionResult.length, 1)
  t.is(
    noDescriptionResult[0].message,
    'A value is required for "description". You must encode the missing information.'
  )
  // setting must not be empty
  const noSettingRow = { ...basicRow, setting: "" }
  const noSettingResult = validateRow(noSettingRow, 7, columns, false)
  t.is(noSettingResult.length, 1)
  t.is(
    noSettingResult[0].message,
    'A value is required for "setting". You must encode the missing information.'
  )
  // setting must be one of CHARGE_SETTINGS
  const wrongSettingRow = { ...basicRow, setting: "everywhere" }
  const wrongSettingResult = validateRow(wrongSettingRow, 8, columns, false)
  t.is(wrongSettingResult.length, 1)
  t.is(
    wrongSettingResult[0].message,
    '"setting" value "everywhere" is not one of the allowed valid values. You must encode one of these valid values: inpatient, outpatient, both'
  )
  // drug_unit_of_measurement must be positive number if present
  const emptyDrugUnitRow = { ...basicRow, drug_unit_of_measurement: "" }
  const emptyDrugUnitResult = validateRow(emptyDrugUnitRow, 9, columns, false)
  t.is(emptyDrugUnitResult.length, 1)
  t.is(
    emptyDrugUnitResult[0].message,
    'A value is required for "drug_unit_of_measurement" when "drug_type_of_measurement" is present. You must encode the missing information.'
  )
  t.assert(emptyDrugUnitResult[0].warning === (enforce2025 ? undefined : true))
  const wrongDrugUnitRow = { ...basicRow, drug_unit_of_measurement: "-4" }
  const wrongDrugUnitResult = validateRow(wrongDrugUnitRow, 10, columns, false)
  t.is(wrongDrugUnitResult.length, 1)
  t.is(
    wrongDrugUnitResult[0].message,
    '"drug_unit_of_measurement" value "-4" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  t.assert(wrongDrugUnitResult[0].warning === (enforce2025 ? undefined : true))
  // drug_type_of_measurement must be one of DRUG_UNITS if present
  const emptyDrugTypeRow = { ...basicRow, drug_type_of_measurement: "" }
  const emptyDrugTypeResult = validateRow(emptyDrugTypeRow, 12, columns, false)
  t.is(emptyDrugTypeResult.length, 1)
  t.is(
    emptyDrugTypeResult[0].message,
    'A value is required for "drug_type_of_measurement" when "drug_unit_of_measurement" is present. You must encode the missing information.'
  )
  t.assert(emptyDrugTypeResult[0].warning === (enforce2025 ? undefined : true))
  const wrongDrugTypeRow = { ...basicRow, drug_type_of_measurement: "KG" }
  const wrongDrugTypeResult = validateRow(wrongDrugTypeRow, 12, columns, false)
  t.is(wrongDrugTypeResult.length, 1)
  t.is(
    wrongDrugTypeResult[0].message,
    '"drug_type_of_measurement" value "KG" is not one of the allowed valid values. You must encode one of these valid values: GR, ME, ML, UN, F2, EA, GM'
  )
  t.assert(wrongDrugTypeResult[0].warning === (enforce2025 ? undefined : true))
  // standard_charge | gross must be positive number if present
  const emptyGrossRow = { ...basicRow, "standard_charge | gross": "" }
  const emptyGrossResult = validateRow(emptyGrossRow, 13, columns, false)
  t.is(emptyGrossResult.length, 0)
  const wrongGrossRow = { ...basicRow, "standard_charge | gross": "3,000" }
  const wrongGrossResult = validateRow(wrongGrossRow, 14, columns, false)
  t.is(wrongGrossResult.length, 1)
  t.is(
    wrongGrossResult[0].message,
    '"standard_charge | gross" value "3,000" is not a positive number. You must encode a positive, non-zero, numeric value.'
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
  t.is(
    wrongDiscountedResult[0].message,
    '"standard_charge | discounted_cash" value "300.25.1" is not a positive number. You must encode a positive, non-zero, numeric value.'
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
  t.is(
    wrongMinResult[0].message,
    '"standard_charge | min" value "-5" is not a positive number. You must encode a positive, non-zero, numeric value.'
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
  t.is(
    wrongMaxResult[0].message,
    '"standard_charge | max" value "-2" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  // no code pairs is invalid
  const noCodesRow = { ...basicRow, "code | 1": "", "code | 1 | type": "" }
  const noCodesResult = validateRow(noCodesRow, 21, columns, false)
  t.is(noCodesResult.length, 1)
  t.is(
    noCodesResult[0].message,
    "If a standard charge is encoded, there must be a corresponding code and code type pairing. The code and code type pairing do not need to be in the first code and code type columns (i.e., code|1 and code|1|type)."
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
  t.is(
    noTypeResult[0].message,
    'A value is required for "code | 1 | type". You must encode the missing information.'
  )
  // a code type without a code is invalid
  const onlyTypeRow = { ...basicRow, "code | 1": "" }
  const onlyTypeResult = validateRow(onlyTypeRow, 24, columns, false)
  t.is(onlyTypeResult.length, 1)
  t.is(
    onlyTypeResult[0].message,
    'A value is required for "code | 1". You must encode the missing information.'
  )
  // a code type must be one of BILLING_CODE_TYPES
  const wrongTypeRow = { ...basicRow, "code | 1 | type": "GUS" }
  const wrongTypeResult = validateRow(wrongTypeRow, 25, columns, false)
  t.is(wrongTypeResult.length, 1)
  t.is(
    wrongTypeResult[0].message,
    '"code | 1 | type" value "GUS" is not one of the allowed valid values. You must encode one of these valid values: CPT, HCPCS, ICD, DRG, MS-DRG, R-DRG, S-DRG, APS-DRG, AP-DRG, APR-DRG, APC, NDC, HIPPS, LOCAL, EAPG, CDT, RC, CDM, TRIS-DRG'
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
  // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
  // then a corresponding valid value for the payer name, plan name, and standard charge methodology must also be encoded.
  const dollarWithInfoRow = {
    ...basicRow,
    "standard_charge | negotiated_dollar": "500",
  }
  const dollarWithInfoErrors = validateRow(dollarWithInfoRow, 5, columns, false)
  t.is(dollarWithInfoErrors.length, 0)
  const dollarMissingInfoRow = {
    ...basicRow,
    "standard_charge | negotiated_dollar": "500",
    payer_name: "",
    plan_name: "",
    "standard_charge | methodology": "",
  }
  const dollarMissingInfoErrors = validateRow(
    dollarMissingInfoRow,
    6,
    columns,
    false
  )
  t.is(dollarMissingInfoErrors.length, 3)
  t.assert(
    dollarMissingInfoErrors[0].message.includes(
      'A value is required for "payer_name" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  t.assert(
    dollarMissingInfoErrors[1].message.includes(
      'A value is required for "plan_name" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  t.assert(
    dollarMissingInfoErrors[2].message.includes(
      'A value is required for "standard_charge | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const percentageWithInfoRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "85",
    estimated_amount: "60",
  }
  const percentageWithInfoErrors = validateRow(
    percentageWithInfoRow,
    7,
    columns,
    false
  )
  t.is(percentageWithInfoErrors.length, 0)
  const percentageMissingInfoRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "85",
    estimated_amount: "60",
    payer_name: "",
    plan_name: "",
    "standard_charge | methodology": "",
  }
  const percentageMissingInfoErrors = validateRow(
    percentageMissingInfoRow,
    8,
    columns,
    false
  )
  t.is(percentageMissingInfoErrors.length, 3)
  t.assert(
    percentageMissingInfoErrors[0].message.includes(
      'A value is required for "payer_name" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  t.assert(
    percentageMissingInfoErrors[1].message.includes(
      'A value is required for "plan_name" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  t.assert(
    percentageMissingInfoErrors[2].message.includes(
      'A value is required for "standard_charge | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )

  const algorithmWithInfoRow = {
    ...basicRow,
    "standard_charge | negotiated_algorithm": "85",
    estimated_amount: "60",
  }
  const algorithmWithInfoErrors = validateRow(
    algorithmWithInfoRow,
    9,
    columns,
    false
  )
  t.is(algorithmWithInfoErrors.length, 0)
  const algorithmMissingInfoRow = {
    ...basicRow,
    "standard_charge | negotiated_algorithm": "standard method function",
    estimated_amount: "60",
    payer_name: "",
    plan_name: "",
    "standard_charge | methodology": "",
  }
  const algorithmMissingInfoErrors = validateRow(
    algorithmMissingInfoRow,
    10,
    columns,
    false
  )
  t.is(algorithmMissingInfoErrors.length, 3)
  t.assert(
    algorithmMissingInfoErrors[0].message.includes(
      'A value is required for "payer_name" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  t.assert(
    algorithmMissingInfoErrors[1].message.includes(
      'A value is required for "plan_name" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  t.assert(
    algorithmMissingInfoErrors[2].message.includes(
      'A value is required for "standard_charge | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )

  // If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found
  // in the "additional notes" for the associated payer-specific negotiated charge.
  const otherWithNotesRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "80",
    estimated_amount: "150",
    "standard_charge | methodology": "other",
    additional_generic_notes: "explanation of methodology",
  }
  const otherWithNotesErrors = validateRow(
    otherWithNotesRow,
    11,
    columns,
    false
  )
  t.is(otherWithNotesErrors.length, 0)
  const otherWithoutNotesRow = {
    ...basicRow,
    "standard_charge | negotiated_percentage": "80",
    estimated_amount: "150",
    "standard_charge | methodology": "other",
  }
  const otherWithoutNotesErrors = validateRow(
    otherWithoutNotesRow,
    12,
    columns,
    false
  )
  t.is(otherWithoutNotesErrors.length, 1)
  t.is(
    otherWithoutNotesErrors[0].message,
    'If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found in the "additional notes" for the associated payer-specific negotiated charge.'
  )

  // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
  // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
  // "Payer-Specific Negotiated Charge: Algorithm".
  const itemNoChargeRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
  }
  const itemNoChargeErrors = validateRow(itemNoChargeRow, 28, columns, false)
  t.is(itemNoChargeErrors.length, 1)
  t.is(
    itemNoChargeErrors[0].message,
    'If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following: "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".'
  )
  const itemGrossChargeRow = {
    ...basicRow,
    "standard_charge | discounted_cash": "",
  }
  const itemGrossChargeErrors = validateRow(
    itemGrossChargeRow,
    29,
    columns,
    false
  )
  t.is(itemGrossChargeErrors.length, 0)
  const itemDiscountedChargeRow = {
    ...basicRow,
    "standard_charge | gross": "",
  }
  const itemDiscountedChargeErrors = validateRow(
    itemDiscountedChargeRow,
    30,
    columns,
    false
  )
  t.is(itemDiscountedChargeErrors.length, 0)
  const itemNegotiatedDollarRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
    "standard_charge | negotiated_dollar": "83",
  }
  const itemNegotiatedDollarErrors = validateRow(
    itemNegotiatedDollarRow,
    31,
    columns,
    false
  )
  t.is(itemNegotiatedDollarErrors.length, 0)
  const itemNegotiatedPercentageRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
    "standard_charge | negotiated_percentage": "24",
    estimated_amount: "25",
  }
  const itemNegotiatedPercentageErrors = validateRow(
    itemNegotiatedPercentageRow,
    32,
    columns,
    false
  )
  t.is(itemNegotiatedPercentageErrors.length, 0)
  const itemNegotiatedAlgorithmRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
    "standard_charge | negotiated_algorithm": "check appendix B",
    estimated_amount: "25",
  }
  const itemNegotiatedAlgorithmErrors = validateRow(
    itemNegotiatedAlgorithmRow,
    33,
    columns,
    false
  )
  t.is(itemNegotiatedAlgorithmErrors.length, 0)

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  const dollarNoBoundsRow = {
    ...basicRow,
    "standard_charge | negotiated_dollar": "300",
    "standard_charge | min": "",
    "standard_charge | max": "",
  }
  const dollarNoBoundsErrors = validateRow(dollarNoBoundsRow, 5, columns, false)
  t.is(dollarNoBoundsErrors.length, 1)
  t.is(
    dollarNoBoundsErrors[0].message,
    'If there is a "payer specific negotiated charge" encoded as a dollar amount, there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.'
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
  t.is(
    percentageNoEstimateErrors[0].message,
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
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
  t.is(
    algorithmNoEstimateErrors[0].message,
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
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
  t.is(ndcNoMeasurementErrors.length, 1)
  t.is(
    ndcNoMeasurementErrors[0].message,
    "If code type is NDC, then the corresponding drug unit of measure and drug type of measure data element must be encoded."
  )
  t.is(ndcNoMeasurementErrors[0].warning, !enforceConditionals)
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
  t.is(ndcSecondNoMeasurementErrors.length, 1)
  t.is(
    ndcSecondNoMeasurementErrors[0].message,
    "If code type is NDC, then the corresponding drug unit of measure and drug type of measure data element must be encoded."
  )
  t.is(ndcSecondNoMeasurementErrors[0].warning, !enforceConditionals)
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
  t.is(
    invalidModifierErrors[0].message,
    "If a modifier is encoded without an item or service, then a description and one of the following is the minimum information required: additional_payer_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm."
  )
  t.is(invalidModifierErrors[0].warning, !enforceConditionals)
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
  t.is(
    modifierWithWrongTypesErrors[0].message,
    '"standard_charge | negotiated_dollar" value "$100" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  t.is(
    modifierWithWrongTypesErrors[1].message,
    '"standard_charge | negotiated_percentage" value "15%" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  t.is(
    modifierWithWrongTypesErrors[2].message,
    '"standard_charge | methodology" value "secret" is not one of the allowed valid values. You must encode one of these valid values: case rate, fee schedule, percent of total billed charges, per diem, other'
  )
})

test("validateColumns wide", (t) => {
  const columns = [
    ...BASE_COLUMNS,
    "code | 1",
    "code | 1 | type",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage",
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm",
    "standard_charge | Payer One | Basic Plan | methodology",
    "estimated_amount | Payer One | Basic Plan",
    "additional_payer_notes | Payer One | Basic Plan",
  ]

  //The idea is that a column could be misnamed.
  const additionalColumns = [
    "standard_charge|[payer_AETNA LIFE AND CAUSAULTY | HMO/PPO]",
    "standard_charge|[payer_AETNA LIFE AND CAUSAULTY | HMO/PPO] |percent",
    "standard_charge|[payer_AETNA LIFE AND CAUSAULTY | HMO/PPO] |contracting_method",
    "additional_payer_notes |[payer_AETNA LIFE AND CAUSAULTY | HMO/PPO]",
    "standard_charge|[payer_ASR HEALTH BEN CIGNA |  COMMERCIAL]",
    "standard_charge|[payer_ASR HEALTH BEN CIGNA |  COMMERCIAL]",
  ]
  t.is(validateColumns(columns).length, 0)
  // any order is okay
  const reverseColumns = [...columns].reverse()
  t.is(validateColumns(reverseColumns).length, 0)
  // the full group of columns for a payer and plan must appear
  // estimated amount is only required in 2025
  const enforce2025 = new Date().getFullYear() >= 2025
  const someColumnsMissing = columns.slice(0, -2)
  const someColumnsMissingErrors = validateColumns(someColumnsMissing)
  t.is(someColumnsMissingErrors.length, 2)
  t.is(
    someColumnsMissingErrors[0].message,
    "Column estimated_amount | Payer One | Basic Plan is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary."
  )
  t.is(someColumnsMissingErrors[0].warning, enforce2025 ? undefined : true)
  t.is(
    someColumnsMissingErrors[1].message,
    "Column additional_payer_notes | Payer One | Basic Plan is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary."
  )
  t.is(someColumnsMissingErrors[1].warning, undefined)

  const customWideColumns = [...columns, ...additionalColumns]

  const someDuplicateErrors = validateColumns(customWideColumns)
  t.is(someDuplicateErrors.length, 12)
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

  // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
  // then a corresponding valid value for the payer name, plan name, and standard charge methodology must also be encoded.
  // Since the wide format incorporates payer name and plan name into the column name, only methodology is checked.
  const dollarWithMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "552",
    "standard_charge | Payer One | Basic Plan | methodology": "fee schedule",
  }
  const dollarWithMethodologyErrors = validateRow(
    dollarWithMethodologyRow,
    5,
    columns,
    true
  )
  t.is(dollarWithMethodologyErrors.length, 0)
  const dollarNoMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "552",
  }
  const dollarNoMethodologyErrors = validateRow(
    dollarNoMethodologyRow,
    6,
    columns,
    true
  )
  t.is(dollarNoMethodologyErrors.length, 1)
  t.assert(
    dollarNoMethodologyErrors[0].message.includes(
      'A value is required for "standard_charge | Payer One | Basic Plan | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const dollarWrongMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "552",
    "standard_charge | Payer Two | Special Plan | methodology": "fee schedule",
  }
  const dollarWrongMethodologyErrors = validateRow(
    dollarWrongMethodologyRow,
    7,
    columns,
    true
  )
  t.is(dollarWrongMethodologyErrors.length, 1)
  t.assert(
    dollarWrongMethodologyErrors[0].message.includes(
      'A value is required for "standard_charge | Payer One | Basic Plan | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const percentageWithMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_percentage": "50",
    "estimated_amount | Payer Two | Special Plan": "244",
    "standard_charge | Payer Two | Special Plan | methodology": "fee schedule",
  }
  const percentageWithMethodologyErrors = validateRow(
    percentageWithMethodologyRow,
    8,
    columns,
    true
  )
  t.is(percentageWithMethodologyErrors.length, 0)
  const percentageNoMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_percentage": "50",
    "estimated_amount | Payer Two | Special Plan": "244",
  }
  const percentageNoMethodologyErrors = validateRow(
    percentageNoMethodologyRow,
    9,
    columns,
    true
  )
  t.is(percentageNoMethodologyErrors.length, 1)
  t.assert(
    percentageNoMethodologyErrors[0].message.includes(
      'A value is required for "standard_charge | Payer Two | Special Plan | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const percentageWrongMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_percentage": "50",
    "estimated_amount | Payer Two | Special Plan": "244",
    "standard_charge | Payer One | Basic Plan | methodology": "fee schedule",
  }
  const percentageWrongMethodologyErrors = validateRow(
    percentageWrongMethodologyRow,
    10,
    columns,
    true
  )
  t.is(percentageWrongMethodologyErrors.length, 1)
  t.assert(
    percentageWrongMethodologyErrors[0].message.includes(
      'A value is required for "standard_charge | Payer Two | Special Plan | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const algorithmWithMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm":
      "consult the appendix",
    "estimated_amount | Payer One | Basic Plan": "245",
    "standard_charge | Payer One | Basic Plan | methodology": "fee schedule",
  }
  const algorithmWithMethodologyErrors = validateRow(
    algorithmWithMethodologyRow,
    11,
    columns,
    true
  )
  t.is(algorithmWithMethodologyErrors.length, 0)
  const algorithmNoMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm":
      "consult the appendix",
    "estimated_amount | Payer One | Basic Plan": "245",
  }
  const algorithmNoMethodologyErrors = validateRow(
    algorithmNoMethodologyRow,
    12,
    columns,
    true
  )
  t.is(algorithmNoMethodologyErrors.length, 1)
  t.assert(
    algorithmNoMethodologyErrors[0].message.includes(
      'A value is required for "standard_charge | Payer One | Basic Plan | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const algorithmWrongMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm":
      "consult the appendix",
    "estimated_amount | Payer One | Basic Plan": "245",
    "standard_charge | Payer Two | Special Plan | methodology": "fee schedule",
  }
  const algorithmWrongMethodologyErrors = validateRow(
    algorithmWrongMethodologyRow,
    12,
    columns,
    true
  )
  t.is(algorithmWrongMethodologyErrors.length, 1)
  t.assert(
    algorithmWrongMethodologyErrors[0].message.includes(
      'A value is required for "standard_charge | Payer One | Basic Plan | methodology" when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm'
    )
  )
  const algorithmInvalidMethodologyRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm":
      "consult the appendix",
    "estimated_amount | Payer One | Basic Plan": "245",
    "standard_charge | Payer One | Basic Plan | methodology":
      "special methodology",
  }
  const algorithmInvalidMethodologyErrors = validateRow(
    algorithmInvalidMethodologyRow,
    13,
    columns,
    true
  )
  t.is(algorithmInvalidMethodologyErrors.length, 1)
  t.assert(
    algorithmInvalidMethodologyErrors[0].message.includes(
      '"standard_charge | Payer One | Basic Plan | methodology" value "special methodology" is not one of the allowed valid values'
    )
  )

  // If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found
  // in the "additional notes" for the associated payer-specific negotiated charge.
  const otherWithNotesRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "estimated_amount | Payer One | Basic Plan": "150",
    "standard_charge | Payer One | Basic Plan | methodology": "other",
    "additional_payer_notes | Payer One | Basic Plan":
      "explanation of methodology",
  }
  const otherWithNotesErrors = validateRow(otherWithNotesRow, 51, columns, true)
  t.is(otherWithNotesErrors.length, 0)
  const otherWithoutNotesRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "estimated_amount | Payer One | Basic Plan": "150",
    "standard_charge | Payer One | Basic Plan | methodology": "other",
    "additional_payer_notes | Payer One | Basic Plan": "",
  }
  const otherWithoutNotesErrors = validateRow(
    otherWithoutNotesRow,
    52,
    columns,
    true
  )
  t.is(otherWithoutNotesErrors.length, 1)
  t.is(
    otherWithoutNotesErrors[0].message,
    'If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found in the "additional notes" for the associated payer-specific negotiated charge.'
  )
  const otherWrongNotesRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "estimated_amount | Payer One | Basic Plan": "150",
    "standard_charge | Payer One | Basic Plan | methodology": "other",
    "additional_payer_notes | Payer Two | Special Plan": "important notes here",
  }
  const otherWrongNotesErrors = validateRow(
    otherWrongNotesRow,
    53,
    columns,
    true
  )
  t.is(otherWrongNotesErrors.length, 1)
  t.is(
    otherWrongNotesErrors[0].message,
    'If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found in the "additional notes" for the associated payer-specific negotiated charge.'
  )

  // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
  // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
  // "Payer-Specific Negotiated Charge: Algorithm".
  const itemNoChargeRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
  }
  const itemNoChargeErrors = validateRow(itemNoChargeRow, 54, columns, true)
  t.is(itemNoChargeErrors.length, 1)
  t.is(
    itemNoChargeErrors[0].message,
    'If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following: "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".'
  )

  const itemGrossChargeRow = {
    ...basicRow,
    "standard_charge | discounted_cash": "",
  }
  const itemGrossChargeErrors = validateRow(
    itemGrossChargeRow,
    55,
    columns,
    true
  )
  t.is(itemGrossChargeErrors.length, 0)
  const itemDiscountedChargeRow = {
    ...basicRow,
    "standard_charge | gross": "",
  }
  const itemDiscountedChargeErrors = validateRow(
    itemDiscountedChargeRow,
    56,
    columns,
    true
  )
  t.is(itemDiscountedChargeErrors.length, 0)
  const itemNegotiatedDollarRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "83",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
  }
  const itemNegotiatedDollarErrors = validateRow(
    itemNegotiatedDollarRow,
    57,
    columns,
    true
  )
  t.is(itemNegotiatedDollarErrors.length, 0)
  const itemNegotiatedPercentageRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
    "standard_charge | Payer Two | Special Plan | negotiated_percentage": "24",
    "standard_charge | Payer Two | Special Plan | methodology": "case rate",
    "estimated_amount | Payer Two | Special Plan": "25",
  }
  const itemNegotiatedPercentageErrors = validateRow(
    itemNegotiatedPercentageRow,
    58,
    columns,
    true
  )
  t.is(itemNegotiatedPercentageErrors.length, 0)
  const itemNegotiatedAlgorithmRow = {
    ...basicRow,
    "standard_charge | gross": "",
    "standard_charge | discounted_cash": "",
    "standard_charge | Payer One | Basic Plan | negotiated_algorithm":
      "check appendix B",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
    "estimated_amount | Payer One | Basic Plan": "25",
  }
  const itemNegotiatedAlgorithmErrors = validateRow(
    itemNegotiatedAlgorithmRow,
    59,
    columns,
    true
  )
  t.is(itemNegotiatedAlgorithmErrors.length, 0)

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  const dollarNoBoundsRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "300",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
    "standard_charge | min": "",
    "standard_charge | max": "",
  }
  const dollarNoBoundsErrors = validateRow(dollarNoBoundsRow, 5, columns, true)
  t.is(dollarNoBoundsErrors.length, 1)
  t.is(
    dollarNoBoundsErrors[0].message,
    'If there is a "payer specific negotiated charge" encoded as a dollar amount, there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.'
  )
  const percentageNoBoundsRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
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
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
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
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
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
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
  }
  const percentageNoEstimateErrors = validateRow(
    percentageNoEstimateRow,
    9,
    columns,
    true
  )
  t.is(percentageNoEstimateErrors.length, 1)
  t.is(
    percentageNoEstimateErrors[0].message,
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
  )
  t.is(percentageNoEstimateErrors[0].warning, !enforceConditionals)
  const percentageWrongEstimateRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "80",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
    "estimated_amount | Payer Two | Special Plan": "55",
  }
  const percentageWrongEstimateErrors = validateRow(
    percentageWrongEstimateRow,
    10,
    columns,
    true
  )
  t.is(percentageWrongEstimateErrors.length, 1)
  t.is(
    percentageWrongEstimateErrors[0].message,
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
  )
  t.is(percentageWrongEstimateErrors[0].warning, !enforceConditionals)
  const algorithmWithEstimateRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm":
      "useful function",
    "standard_charge | Payer Two | Special Plan | methodology": "case rate",
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
    "standard_charge | Payer Two | Special Plan | methodology": "case rate",
  }
  const algorithmNoEstimateErrors = validateRow(
    algorithmNoEstimateRow,
    12,
    columns,
    true
  )
  t.is(algorithmNoEstimateErrors.length, 1)
  t.is(
    algorithmNoEstimateErrors[0].message,
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
  )
  t.is(algorithmNoEstimateErrors[0].warning, !enforceConditionals)
  const algorithmWrongEstimateRow = {
    ...basicRow,
    "standard_charge | Payer Two | Special Plan | negotiated_algorithm":
      "useful function",
    "standard_charge | Payer Two | Special Plan | methodology": "case rate",
    "estimated_amount | Payer One | Basic Plan": "55",
  }
  const algorithmWrongEstimateErrors = validateRow(
    algorithmWrongEstimateRow,
    13,
    columns,
    true
  )
  t.is(algorithmWrongEstimateErrors.length, 1)
  t.is(
    algorithmWrongEstimateErrors[0].message,
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
  )
  t.is(algorithmWrongEstimateErrors[0].warning, !enforceConditionals)

  // If code type is NDC, then the corresponding drug unit of measure and
  // drug type of measure data elements must be encoded. Required beginning 1/1/2025.
  const ndcNoMeasurementRow = {
    ...basicRow,
    "code | 1 | type": "NDC",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "300",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
  }
  const ndcNoMeasurementErrors = validateRow(
    ndcNoMeasurementRow,
    14,
    columns,
    true
  )
  t.is(ndcNoMeasurementErrors.length, 1)
  t.is(
    ndcNoMeasurementErrors[0].message,
    "If code type is NDC, then the corresponding drug unit of measure and drug type of measure data element must be encoded."
  )
  t.is(ndcNoMeasurementErrors[0].warning, !enforceConditionals)
  const ndcSecondNoMeasurementRow = {
    ...basicRow,
    "code | 2": "12345",
    "code | 2 | type": "NDC",
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "300",
    "standard_charge | Payer One | Basic Plan | methodology": "case rate",
    drug_unit_of_measurement: "",
    drug_type_of_measurement: "",
  }
  const ndcSecondNoMeasurementErrors = validateRow(
    ndcSecondNoMeasurementRow,
    15,
    columns,
    true
  )
  t.is(ndcSecondNoMeasurementErrors.length, 1)
  t.is(
    ndcSecondNoMeasurementErrors[0].message,
    "If code type is NDC, then the corresponding drug unit of measure and drug type of measure data element must be encoded."
  )
  t.is(ndcSecondNoMeasurementErrors[0].warning, !enforceConditionals)

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
  t.is(
    invalidModifierErrors[0].message,
    "If a modifier is encoded without an item or service, then a description and one of the following is the minimum information required: additional_payer_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm."
  )
  t.is(invalidModifierErrors[0].warning, !enforceConditionals)
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
  t.is(
    modifierWithWrongTypesErrors[0].message,
    '"standard_charge | Payer One | Basic Plan | negotiated_dollar" value "$100" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  t.is(
    modifierWithWrongTypesErrors[1].message,
    '"standard_charge | Payer One | Basic Plan | negotiated_percentage" value "15%" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  t.is(
    modifierWithWrongTypesErrors[2].message,
    '"standard_charge | Payer Two | Special Plan | methodology" value "secret" is not one of the allowed valid values. You must encode one of these valid values: case rate, fee schedule, percent of total billed charges, per diem, other'
  )

  const zeroNumericRow = {
    ...basicRow,
    "standard_charge | Payer One | Basic Plan | negotiated_dollar": "0",
    "standard_charge | Payer One | Basic Plan | negotiated_percentage": "0",
    "standard_charge | Payer One | Basic Plan | methodology": "per diem",
  }
  const zeroNumericRowErrors = validateRow(zeroNumericRow, 22, columns, true)
  t.is(zeroNumericRowErrors.length, 2)
  t.is(
    zeroNumericRowErrors[0].message,
    '"standard_charge | Payer One | Basic Plan | negotiated_dollar" value "0" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
  t.is(
    zeroNumericRowErrors[1].message,
    '"standard_charge | Payer One | Basic Plan | negotiated_percentage" value "0" is not a positive number. You must encode a positive, non-zero, numeric value.'
  )
})

test("collectAlerts tall", (t) => {
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

  const basicResult = collectAlerts(basicRow, 5, columns, false)
  t.is(basicResult.length, 0)

  const nineNineRow = {
    ...basicRow,
    estimated_amount: "999999999",
  }
  const nineNineResult = collectAlerts(nineNineRow, 6, columns, false)
  t.is(nineNineResult.length, 1)
  t.is(
    nineNineResult[0].message,
    "Nine 9s should not be used for estimated amount."
  )
  t.is(nineNineResult[0].field, "estimated_amount")

  const nineNineDecimalRow = {
    ...basicRow,
    estimated_amount: "999999999.00",
  }
  const nineNineDecimalResult = collectAlerts(
    nineNineDecimalRow,
    7,
    columns,
    false
  )
  t.is(nineNineDecimalResult.length, 1)
  t.is(
    nineNineDecimalResult[0].message,
    "Nine 9s should not be used for estimated amount."
  )
  t.is(nineNineDecimalResult[0].field, "estimated_amount")
})

test("collectAlerts wide", (t) => {
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

  const basicResult = collectAlerts(basicRow, 5, columns, true)
  t.is(basicResult.length, 0)

  const singleNineNineRow = {
    ...basicRow,
    "estimated_amount | Payer Two | Special Plan": "999999999",
  }
  const singleNineNineResult = collectAlerts(
    singleNineNineRow,
    6,
    columns,
    true
  )
  t.is(singleNineNineResult.length, 1)
  t.is(
    singleNineNineResult[0].message,
    "Nine 9s should not be used for estimated amount."
  )
  t.is(
    singleNineNineResult[0].field,
    "estimated_amount | Payer Two | Special Plan"
  )

  const multiNineNineRow = {
    ...basicRow,
    "estimated_amount | Payer One | Basic Plan": "999999999",
    "estimated_amount | Payer Two | Special Plan": "999999999.0",
  }
  const multiNineNineResult = collectAlerts(multiNineNineRow, 7, columns, true)
  t.is(multiNineNineResult.length, 2)
  t.is(
    multiNineNineResult[0].message,
    "Nine 9s should not be used for estimated amount."
  )
  t.is(
    multiNineNineResult[0].field,
    "estimated_amount | Payer One | Basic Plan"
  )
  t.is(
    multiNineNineResult[1].message,
    "Nine 9s should not be used for estimated amount."
  )
  t.is(
    multiNineNineResult[1].field,
    "estimated_amount | Payer Two | Special Plan"
  )
})
