import { CsvValidationError, StateCode, STATE_CODES } from "../../types.js"
import {
  csvErr,
  sepColumnsEqual,
  parseSepField,
  getCodeCount,
} from "../common/csv.js"
import {
  BILLING_CODE_TYPES,
  BillingCodeType,
  CHARGE_SETTINGS,
  CONTRACTING_METHODS,
  ChargeSetting,
  ContractingMethod,
  DRUG_UNITS,
  DrugUnit,
} from "./types.js"

const ATTESTATION =
  "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated."

export const HEADER_COLUMNS = [
  "hospital_name",
  "last_updated_on",
  "version",
  "hospital_location",
  "hospital_address",
  "license_number | state",
  ATTESTATION,
]

export const BASE_COLUMNS = [
  "description",
  "setting",
  "drug_unit_of_measurement",
  "drug_type_of_measurement",
  "modifiers",
  "standard_charge | gross",
  "standard_charge | discounted_cash",
]

export const MIN_MAX_COLUMNS = [
  "standard_charge | min",
  "standard_charge | max",
]

export const TALL_COLUMNS = [
  "payer_name",
  "plan_name",
  "standard_charge | negotiated_dollar",
  "standard_charge | negotiated_percentage",
  "standard_charge | methodology",
  "additional_generic_notes",
]

const ERRORS = {
  HEADER_COLUMN_NAME: (actual: string, expected: string) =>
    `Header column is "${actual}", it should be "${expected}"`,
  HEADER_COLUMN_MISSING: (column: string) =>
    `Header column should be "${column}", but it is not present`,
  HEADER_COLUMN_COUNT: (actual: number) =>
    `${HEADER_COLUMNS.length} header fields are required and only ${actual} are present`,
  HEADER_COLUMN_BLANK: (column: string) => `"${column}" is blank`,
  HEADER_STATE_CODE: (column: string, stateCode: string) =>
    `Header column "${column}" includes an invalid state code "${stateCode}"`,
  COLUMN_COUNT: (actual: number, expected: number) =>
    `Received ${actual} columns, less than the required number ${expected}`,
  COLUMN_MISSING: (expected: string, format: string) =>
    `Missing expected column "${expected} for ${format} format`,
  COLUMN_NAME: (actual: string, expected: string, format: string) =>
    `Column is "${actual}" and should be "${expected}" for ${format} format`,
  NOTES_COLUMN: (column: string) =>
    `The last column should be "additional_generic_notes", is "${column}"`,
  ALLOWED_VALUES: (column: string, value: string, allowedValues: string[]) =>
    `"${column}" value "${value}" is not one of the allowed values: ${allowedValues
      .map((t) => `"${t}"`)
      .join(", ")}`,
  INVALID_NUMBER: (column: string, value: string) =>
    `"${column}" value "${value}" is not a valid number`,
  POSITIVE_NUMBER: (column: string, suffix = ``) =>
    `"${column}" is required to be a positive number${suffix}`,
  CHARGE_ONE_REQUIRED: (column: string) => {
    const fieldName = column.replace(" | percent", "")
    return `One of "${fieldName}" or "${fieldName} | percent" is required`
  },
  REQUIRED: (column: string, suffix = ``) => `"${column}" is required${suffix}`,
  CHARGE_PERCENT_REQUIRED_SUFFIX: " (one of charge or percent is required)",
}

/** @private */
export function validateHeader(
  columns: string[],
  row: string[]
): CsvValidationError[] {
  return [...validateHeaderColumns(columns), ...validateHeaderRow(columns, row)]
}

/** @private */
export function validateHeaderColumns(columns: string[]): CsvValidationError[] {
  const rowIndex = 0
  const errors: CsvValidationError[] = []
  HEADER_COLUMNS.forEach((headerColumn, index) => {
    // TODO: findIndex instead of iterating through
    if (index < columns.length) {
      if (headerColumn === "license_number | state") {
        errors.push(
          ...validateLicenseStateColumn(columns[index], rowIndex, index)
        )
        return
      }
      if (!sepColumnsEqual(columns[index], headerColumn)) {
        errors.push(
          csvErr(
            rowIndex,
            index,
            headerColumn,
            ERRORS.HEADER_COLUMN_NAME(columns[index], headerColumn),
            false
          )
        )
      }
      if (!sepColumnsEqual(columns[index], headerColumn)) {
        errors.push(
          csvErr(
            rowIndex,
            index,
            headerColumn,
            ERRORS.HEADER_COLUMN_NAME(columns[index], headerColumn),
            false
          )
        )
      }
    } else {
      errors.push(
        csvErr(
          rowIndex,
          index,
          headerColumn,
          ERRORS.HEADER_COLUMN_MISSING(headerColumn)
        )
      )
    }
  })
  return errors
}

/** @private */
export function validateHeaderRow(
  columns: string[],
  row: string[]
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  const rowIndex = 1

  if (row.length < HEADER_COLUMNS.length) {
    return [
      {
        row: rowIndex,
        column: 0,
        message: ERRORS.HEADER_COLUMN_COUNT(row.length),
      },
    ]
  }

  const checkBlankColumns = [
    "hospital_name",
    "version",
    "hospital_location",
    "hospital_address",
    "last_updated_on",
    ATTESTATION,
  ]
  checkBlankColumns.forEach((checkBlankColumn) => {
    const headerIndex = columns.indexOf(checkBlankColumn)
    if (!row[headerIndex].trim()) {
      errors.push(
        csvErr(
          rowIndex,
          headerIndex,
          checkBlankColumn,
          ERRORS.HEADER_COLUMN_BLANK(checkBlankColumn)
        )
      )
    }
  })

  const licenseStateIndex = columns.findIndex((c) =>
    c.includes("license_number")
  )
  const licenseStateField = columns.find((c) => c.includes("license_number"))

  if (!row[licenseStateIndex].trim()) {
    errors.push(
      csvErr(
        rowIndex,
        licenseStateIndex,
        licenseStateField,
        ERRORS.HEADER_COLUMN_BLANK(licenseStateField as string),
        true
      )
    )
  }

  return errors
}

/** @private */
export function validateColumns(columns: string[]): CsvValidationError[] {
  const rowIndex = 2
  const errors: CsvValidationError[] = []

  const tall = isTall(columns)

  const baseColumns = getBaseColumns(columns)
  const wideColumns = getWideColumns(columns)
  const tallColumns = getTallColumns(columns)
  const schemaFormat = tall ? "tall" : "wide"
  const totalColumns = baseColumns.concat(tall ? tallColumns : wideColumns)

  if (columns.length < totalColumns.length) {
    return [
      csvErr(
        rowIndex,
        0,
        undefined,
        ERRORS.COLUMN_COUNT(columns.length, baseColumns.length)
      ),
    ]
  }

  totalColumns.forEach((column) => {
    const columnIndex = columns.findIndex((c) => sepColumnsEqual(c, column))
    if (columnIndex === -1) {
      errors.push(
        csvErr(rowIndex, 0, column, ERRORS.COLUMN_MISSING(column, schemaFormat))
      )
    }
  })

  return errors
}

/** @private */
export function validateRow(
  row: { [key: string]: string },
  index: number,
  columns: string[],
  wide = false
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  const requiredFields = ["description"]
  requiredFields.forEach((field) =>
    errors.push(
      ...validateRequiredField(
        row,
        field,
        index,
        columns.findIndex((c) => sepColumnsEqual(field, c))
      )
    )
  )

  if (
    row["code | 1"] &&
    !BILLING_CODE_TYPES.includes(row["code | 1 | type"] as BillingCodeType)
  ) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("code | 1 | type"),
        "code | 1 | type",
        ERRORS.ALLOWED_VALUES(
          "code | 1 | type",
          row["code | 1 | type"],
          BILLING_CODE_TYPES as unknown as string[]
        ),
        true
      )
    )
  }

  if (
    row["code | 2"] &&
    !BILLING_CODE_TYPES.includes(row["code | 2 | type"] as BillingCodeType)
  ) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("code | 2 | type"),
        "code | 2 | type",
        ERRORS.ALLOWED_VALUES(
          "code | 2 | type",
          row["code | 2 | type"],
          BILLING_CODE_TYPES as unknown as string[]
        )
      )
    )
  }

  if (!CHARGE_SETTINGS.includes(row["setting"] as ChargeSetting)) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("setting"),
        "setting",
        ERRORS.ALLOWED_VALUES(
          "setting",
          row["setting"],
          CHARGE_SETTINGS as unknown as string[]
        )
      )
    )
  }

  if (row["drug_unit_of_measurement"]) {
    if (!/\d+(\.\d+)?/g.test(row["drug_unit_of_measurement"])) {
      errors.push(
        csvErr(
          index,
          columns.indexOf("drug_unit_of_measurement"),
          "drug_unit_of_measurement",
          ERRORS.INVALID_NUMBER(
            "drug_unit_of_measurement",
            row["drug_unit_of_measurement"]
          )
        )
      )
    }
    if (!DRUG_UNITS.includes(row["drug_type_of_measurement"] as DrugUnit)) {
      errors.push(
        csvErr(
          index,
          columns.indexOf("drug_type_of_measurement"),
          "drug_type_of_measurement",
          ERRORS.ALLOWED_VALUES(
            "drug_type_of_measurement",
            row["drug_type_of_measurement"],
            DRUG_UNITS as unknown as string[]
          )
        )
      )
    }
  }

  const chargeFields = [
    "standard_charge | gross",
    "standard_charge | discounted_cash",
    "standard_charge | min",
    "standard_charge | max",
  ]

  chargeFields.forEach((field) => {
    if ((row[field] || "").trim()) {
      errors.push(
        ...validateFloatField(
          row,
          field,
          index,
          columns.findIndex((c) => sepColumnsEqual(field, c))
        )
      )
    }
  })

  if (wide) {
    errors.push(...validateWideFields(row, index, columns))
  } else {
    errors.push(...validateTallFields(row, index, columns))
  }

  return errors
}

/** @private */
export function validateWideFields(
  row: { [key: string]: string },
  index: number,
  columns: string[]
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  Object.entries(row).forEach(([field, value]) => {
    const colIndex = columns.findIndex((c) => sepColumnsEqual(field, c))
    if (
      field.includes("methodology") &&
      value.trim() &&
      !CONTRACTING_METHODS.includes(value as ContractingMethod)
    ) {
      errors.push(
        csvErr(
          index,
          colIndex,
          field,
          ERRORS.ALLOWED_VALUES(
            field,
            value,
            CONTRACTING_METHODS as unknown as string[]
          )
        )
      )
    } else if (field.includes("standard_charge")) {
      // TODO: Implement any logic around requiring either dollar or percentage
    }
  })
  return errors
}

function validateLicenseStateColumn(
  column: string,
  rowIndex: number,
  columnIndex: number
): CsvValidationError[] {
  const LICENSE_STATE = "license_number | state"
  const invalidMessage = ERRORS.HEADER_COLUMN_NAME(
    column,
    "license_number | <state>"
  )
  const splitColumn = column.split("|").map((v) => v.trim())
  if (splitColumn.length !== 2) {
    return [csvErr(rowIndex, columnIndex, LICENSE_STATE, invalidMessage)]
  }
  const stateCode = column.split("|").slice(-1)[0].trim()
  if (!STATE_CODES.includes(stateCode as StateCode)) {
    return [
      csvErr(
        rowIndex,
        columnIndex,
        LICENSE_STATE,
        ERRORS.HEADER_STATE_CODE(column, stateCode)
      ),
    ]
  } else if (!sepColumnsEqual(column, `license_number | ${stateCode}`)) {
    return [csvErr(rowIndex, columnIndex, LICENSE_STATE, invalidMessage)]
  }
  return []
}

/** @private */
export function validateTallFields(
  row: { [key: string]: string },
  index: number,
  columns: string[]
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  const requiredFields = ["payer_name", "plan_name"]
  requiredFields.forEach((field) =>
    errors.push(
      ...validateRequiredField(
        row,
        field,
        index,
        columns.findIndex((c) => sepColumnsEqual(field, c))
      )
    )
  )

  // TODO: Missing some here

  // TODO: Only one of these has to be filled, clarify error
  const floatFields = [
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percentage",
  ]
  const floatErrors = floatFields.flatMap((field) =>
    validateFloatField(
      row,
      field,
      index,
      columns.findIndex((c) => sepColumnsEqual(field, c)),
      ERRORS.CHARGE_PERCENT_REQUIRED_SUFFIX
    )
  )
  // TODO: Is it an error if both fields are present?
  // Only one of these has to be filled, so if only one errors out ignore it
  if (floatErrors.length > 1) {
    errors.push(...floatErrors)
  }

  if (
    !CONTRACTING_METHODS.includes(
      row["standard_charge | methodology"] as ContractingMethod
    )
  ) {
    errors.push(
      csvErr(
        index,
        BASE_COLUMNS.indexOf("standard_charge | methodology"),
        // TODO: Change to constants
        "standard_charge | methodology",
        ERRORS.ALLOWED_VALUES(
          "standard_charge | methodology",
          row["standard_charge | methodology"],
          CONTRACTING_METHODS as unknown as string[]
        )
      )
    )
  }

  return errors
}

/** @private */
export function getBaseColumns(columns: string[]): string[] {
  const codeCount = Math.max(1, getCodeCount(columns))
  const codeColumns = Array(codeCount)
    .fill(0)
    .flatMap((_, i) => [`code | ${i + 1}`, `code | ${i + 1} | type`])

  return [
    "description",
    ...codeColumns,
    "setting",
    "drug_unit_of_measurement",
    "drug_type_of_measurement",
    "modifiers",
    "standard_charge | gross",
    "standard_charge | discounted_cash",
  ]
}

/** @private */
export function getWideColumns(columns: string[]): string[] {
  const payersPlans = getPayersPlans(columns)
  const payersPlansColumns: string[] = payersPlans
    .flatMap((payerPlan) => [
      ["standard_charge", ...payerPlan],
      ["standard_charge", ...payerPlan, "negotiated_dollar"],
      ["standard_charge", ...payerPlan, "negotiated_percentage"],
      ["standard_charge", ...payerPlan, "negotiated_algorithm"],
      ["standard_charge", ...payerPlan, "methodology"],
      ["estimated_amount", ...payerPlan],
      ["additional_payer_notes", ...payerPlan],
    ])
    .map((c) => c.join(" | "))

  return [
    ...payersPlansColumns.slice(0, 2),
    ...MIN_MAX_COLUMNS,
    ...payersPlansColumns.slice(2),
  ]
}

/** @private */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTallColumns(columns: string[]): string[] {
  return [
    "payer_name",
    "plan_name",
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percentage",
    "standard_charge | negotiated_algorithm",
    "standard_charge | min",
    "standard_charge | max",
    "standard_charge | methodology",
    "estimated_amount",
    "additional_generic_notes",
  ]
}

function getPayersPlans(columns: string[]): string[][] {
  const excludeSegments = [
    "standard_charge",
    "min",
    "max",
    "gross",
    "discounted_cash",
  ]
  return Array.from(
    new Set(
      columns
        .filter((c) => c.includes("standard_charge"))
        .map((c) =>
          parseSepField(c).filter((w) => !!w && !excludeSegments.includes(w))
        )
        .filter((f) => f.length === 2)
        .map((f) => f.join("|"))
        .filter((c) => !!c)
    )
  ).map((v) => v.split("|"))
}

function validateRequiredField(
  row: { [key: string]: string },
  field: string,
  rowIndex: number,
  columnIndex: number,
  suffix = ``
): CsvValidationError[] {
  if (!(row[field] || "").trim()) {
    return [
      csvErr(rowIndex, columnIndex, field, ERRORS.REQUIRED(field, suffix)),
    ]
  }
  return []
}

function validateFloatField(
  row: { [key: string]: string },
  field: string,
  rowIndex: number,
  columnIndex: number,
  suffix = ``
): CsvValidationError[] {
  if (!/\d+(\.\d+)?/g.test(row[field] || "")) {
    return [
      csvErr(
        rowIndex,
        columnIndex,
        field,
        ERRORS.POSITIVE_NUMBER(field, suffix)
      ),
    ]
  }
  return []
}

// TODO: Better way of getting this?
/** @private */
export function isTall(columns: string[]): boolean {
  return ["payer_name", "plan_name"].every((c) => columns.includes(c))
}

export const CsvValidatorTwoZero = {
  validateHeader,
  validateColumns,
  validateRow,
  isTall,
}
