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
  CHARGE_BILLING_CLASSES,
  CHARGE_SETTINGS,
  CONTRACTING_METHODS,
  ChargeBillingClass,
  ChargeSetting,
  ContractingMethod,
  DRUG_UNITS,
  DrugUnit,
} from "./types"

// CSV is being allowed to have case insensitive values...
const STATE_CODES_CSV = STATE_CODES.map((state) => state.toLowerCase())
const BILLING_CODE_TYPES_CSV = BILLING_CODE_TYPES.map((code) =>
  code.toLowerCase()
)
const DRUG_UNITS_CSV = DRUG_UNITS.map((unit) => unit.toLowerCase())

export const HEADER_COLUMNS = [
  "hospital_name",
  "last_updated_on",
  "version",
  "hospital_location",
  "financial_aid_policy",
  "license_number | state",
]

export const BASE_COLUMNS = [
  "description",
  "billing_class",
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
  "standard_charge | negotiated_percent",
  "standard_charge | contracting_method",
  "additional_generic_notes",
]

const ERRORS = {
  HEADER_COLUMN_NAME: (actual: string, expected: string) =>
    `Header column is "${actual}", it should be "${expected}"`,
  HEADER_COLUMN_MISSING: (column: string) =>
    `Header column should be "${column}", but it is not present`,
  HEADER_COLUMN_BLANK: (column: string) => `"${column}" is blank`,
  HEADER_STATE_CODE: (column: string, stateCode: string) =>
    `Header column "${column}" includes an invalid state code "${stateCode}"`,
  COLUMN_NAME: (actual: string, expected: string, format: string) =>
    `Column is "${actual}" and should be "${expected}" for ${format} format`,
  COLUMN_MISSING: (column: string, format: string) =>
    `Column ${column} is missing, but it is required for ${format} format`,
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
  const { errors: headerErrors, columns: headerColumns } =
    validateHeaderColumns(columns)
  const rowErrors = validateHeaderRow(headerColumns, row)
  return [...headerErrors, ...rowErrors]
}

/** @private */
export function validateHeaderColumns(columns: string[]): {
  errors: CsvValidationError[]
  columns: (string | undefined)[]
} {
  const rowIndex = 0
  const remainingColumns = [...HEADER_COLUMNS]
  const discoveredColumns: string[] = []
  columns.forEach((column, index) => {
    const matchingColumnIndex = remainingColumns.findIndex((requiredColumn) => {
      if (requiredColumn === "license_number | state") {
        // see if it works
        const licenseStateErrors = validateLicenseStateColumn(
          column,
          rowIndex,
          index
        )
        return licenseStateErrors.length === 0
      } else {
        return sepColumnsEqual(column, requiredColumn)
      }
    })
    if (matchingColumnIndex > -1) {
      discoveredColumns[index] = column
      remainingColumns.splice(matchingColumnIndex, 1)
    }
  })
  return {
    errors: remainingColumns.map((requiredColumn) => {
      return csvErr(
        rowIndex,
        columns.length,
        requiredColumn,
        ERRORS.HEADER_COLUMN_MISSING(requiredColumn)
      )
    }),
    columns: discoveredColumns,
  }
}

/** @private */
export function validateHeaderRow(
  headers: (string | undefined)[],
  row: string[]
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  const rowIndex = 1

  headers.forEach((header, index) => {
    if (header != null) {
      if (!row[index]?.trim()) {
        errors.push(
          csvErr(rowIndex, index, header, ERRORS.HEADER_COLUMN_BLANK(header))
        )
      }
    }
  })

  return errors
}

/** @private */
export function validateColumns(columns: string[]): CsvValidationError[] {
  const rowIndex = 2

  const tall = isTall(columns)

  const baseColumns = getBaseColumns(columns)
  const wideColumns = getWideColumns(columns)
  const tallColumns = getTallColumns(columns)
  const schemaFormat = tall ? "tall" : "wide"
  const remainingColumns = baseColumns.concat(tall ? tallColumns : wideColumns)

  columns.forEach((column) => {
    const matchingColumnIndex = remainingColumns.findIndex((requiredColumn) =>
      sepColumnsEqual(column, requiredColumn)
    )
    if (matchingColumnIndex > -1) {
      remainingColumns.splice(matchingColumnIndex, 1)
    }
  })

  return remainingColumns.map((requiredColumn) => {
    return csvErr(
      rowIndex,
      columns.length,
      requiredColumn,
      ERRORS.COLUMN_MISSING(requiredColumn, schemaFormat)
    )
  })
}

/** @private */
export function validateRow(
  row: { [key: string]: string },
  index: number,
  columns: string[],
  wide = false
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  const requiredFields = ["description", "code | 1"]
  requiredFields.forEach((field) =>
    errors.push(
      ...validateRequiredField(row, field, index, columns.indexOf(field))
    )
  )

  if (!BILLING_CODE_TYPES_CSV(row["code | 1 | type"] as BillingCodeType)) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("code | 1 | type"),
        "code | 1 | type",
        ERRORS.ALLOWED_VALUES(
          "code | 1 | type",
          row["code | 1 | type"],
          BILLING_CODE_TYPES_CSV as unknown as string[]
        ),
        true
      )
    )
  }

  // TODO: Code itself is required, need to check all of those, not all checked here
  if (
    row["code | 2"] &&
    !BILLING_CODE_TYPES_CSV.includes(row["code | 2 | type"] as BillingCodeType)
  ) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("code | 2 | type"),
        "code | 2 | type",
        ERRORS.ALLOWED_VALUES(
          "code | 2 | type",
          row["code | 2 | type"],
          BILLING_CODE_TYPES_CSV as unknown as string[]
        )
      )
    )
  }

  if (
    !CHARGE_BILLING_CLASSES.includes(row["billing_class"] as ChargeBillingClass)
  ) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("billing_class"),
        "billing_class",
        ERRORS.ALLOWED_VALUES(
          "billing_class",
          row["billing_class"],
          CHARGE_BILLING_CLASSES as unknown as string[]
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
    if (!DRUG_UNITS_CSV.includes(row["drug_type_of_measurement"] as DrugUnit)) {
      errors.push(
        csvErr(
          index,
          columns.indexOf("drug_type_of_measurement"),
          "drug_type_of_measurement",
          ERRORS.ALLOWED_VALUES(
            "drug_type_of_measurement",
            row["drug_type_of_measurement"],
            DRUG_UNITS_CSV as unknown as string[]
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
  chargeFields.forEach((field) =>
    errors.push(
      ...validateRequiredFloatField(row, field, index, columns.indexOf(field))
    )
  )

  if (wide) {
    errors.push(...validateWideFields(row, index))
  } else {
    errors.push(...validateTallFields(row, index))
  }

  return errors
}

/** @private */
export function validateWideFields(
  row: { [key: string]: string },
  index: number
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  // TODO: Is checking that all are present covered in checking columns?
  // TODO: Is order maintained on entries? likely not
  Object.entries(row).forEach(([field, value], columnIndex) => {
    if (
      field.includes("contracting_method") &&
      !CONTRACTING_METHODS.includes(value as ContractingMethod)
    ) {
      errors.push(
        csvErr(
          index,
          BASE_COLUMNS.length + columnIndex,
          field,
          ERRORS.ALLOWED_VALUES(
            field,
            value,
            CONTRACTING_METHODS as unknown as string[]
          )
        )
      )
    } else if (field.includes("standard_charge")) {
      if (
        field.includes(" | percent") &&
        !value.trim() &&
        !row[field.replace(" | percent", "")].trim()
      ) {
        errors.push(
          csvErr(
            index,
            BASE_COLUMNS.length + columnIndex,
            field, // TODO: Might be different?
            ERRORS.CHARGE_ONE_REQUIRED(field)
          )
        )
      }
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
  if (!STATE_CODES_CSV.includes(stateCode as StateCode)) {
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
  index: number
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  const requiredFields = ["payer_name", "plan_name"]
  requiredFields.forEach((field) =>
    errors.push(
      ...validateRequiredField(
        row,
        field,
        index,
        BASE_COLUMNS.length + TALL_COLUMNS.indexOf(field)
      )
    )
  )

  // TODO: Only one of these has to be filled, clarify error
  const floatFields = [
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percent",
  ]
  const floatErrors = floatFields.flatMap((field) =>
    validateRequiredFloatField(
      row,
      field,
      index,
      BASE_COLUMNS.length + TALL_COLUMNS.indexOf(field),
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
      row["standard_charge | contracting_method"] as ContractingMethod
    )
  ) {
    errors.push(
      csvErr(
        index,
        BASE_COLUMNS.indexOf("standard_charge | contracting_method"),
        // TODO: Change to constants
        "standard_charge | contracting_method",
        ERRORS.ALLOWED_VALUES(
          "standard_charge | contracting_method",
          row["standard_charge | contracting_method"],
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
    "billing_class",
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
      ["standard_charge", ...payerPlan, "percent"],
      ["standard_charge", ...payerPlan, "contracting_method"],
      ["additional_payer_notes", ...payerPlan],
    ])
    .map((c) => c.join(" | "))

  return [
    ...payersPlansColumns.slice(0, 2),
    ...MIN_MAX_COLUMNS,
    ...payersPlansColumns.slice(2),
    "additional_generic_notes",
  ]
}

/** @private */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTallColumns(columns: string[]): string[] {
  return [
    "payer_name",
    "plan_name",
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percent",
    "standard_charge | min",
    "standard_charge | max",
    "standard_charge | contracting_method",
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
    "contracting_method",
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

function validateRequiredFloatField(
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
