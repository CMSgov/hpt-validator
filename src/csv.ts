import {
  ValidationResult,
  STATE_CODES,
  StateCode,
  BILLING_CODE_TYPES,
  BillingCodeType,
  CHARGE_SETTINGS,
  ChargeSetting,
  DRUG_UNITS,
  DrugUnit,
  CONTRACTING_METHODS,
  ContractingMethod,
  CHARGE_BILLING_CLASSES,
  ChargeBillingClass,
  CsvValidationError,
  ValidationError,
} from "./types.js"
import Papa from "papaparse"

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

/**
 *
 * @param input Browser File or ReadableStream for streaming file content
 * @param onValueCallback Callback function to process streamed CSV row object
 * @returns Promise that resolves with the result of validation
 */
export async function validateCsv(
  input: File | NodeJS.ReadableStream,
  onValueCallback?: (value: { [key: string]: string }) => void
): Promise<ValidationResult> {
  let index = 0
  const errors: CsvValidationError[] = []
  let headerColumns: string[]
  let dataColumns: string[]
  let tall = false

  const handleParseStep = (
    step: Papa.ParseStepResult<string[]>,
    resolve: (result: ValidationResult | PromiseLike<ValidationResult>) => void
  ) => {
    const row: string[] = step.data
    // Ignore empty lines
    if (rowIsEmpty(row)) {
      ++index
      return
    }
    if (index === 0) {
      headerColumns = row
    } else if (index === 1) {
      errors.push(...validateHeader(headerColumns, row))
    } else if (index === 2) {
      dataColumns = row
      errors.push(...validateColumns(dataColumns))
      if (errors.length > 0) {
        resolve({
          valid: false,
          errors: errors.map(csvErrorToValidationError).concat({
            path: csvCellName(0, 0),
            message: "Errors were seen in headers so rows were not evaluated",
          }),
        })
      } else {
        tall = isTall(dataColumns)
      }
    } else {
      const cleanRow = cleanRowFields(objectFromKeysValues(dataColumns, row))
      errors.push(...validateRow(cleanRow, index, dataColumns, !tall))
      if (onValueCallback) {
        onValueCallback(cleanRow)
      }
    }

    ++index
  }

  const handleParseEnd = (
    resolve: (result: ValidationResult | PromiseLike<ValidationResult>) => void
  ): void => {
    if (index < 4) {
      resolve({
        valid: false,
        errors: [
          {
            path: csvCellName(0, 0),
            message: "At least one row must be present",
          },
        ],
      })
    } else {
      resolve({
        valid: !errors.some(({ warning }) => !warning),
        errors: errors.map(csvErrorToValidationError),
      })
    }
  }

  return new Promise((resolve, reject) => {
    Papa.parse(input, {
      header: false,
      // chunkSize: 64 * 1024,
      step: (row: Papa.ParseStepResult<string[]>) =>
        handleParseStep(row, resolve),
      complete: () => handleParseEnd(resolve),
      error: (error: Error) => reject(error),
    })
  })
}

/**
 *
 * @param csvString String body of CSV
 * @returns results of validation
 */
export function validateCsvSync(csvString: string): ValidationResult {
  const valid = true
  const errors: CsvValidationError[] = []
  const { data } = Papa.parse(csvString, {
    header: false,
    download: false,
    worker: false,
  })

  if (data.length < 4) {
    return {
      valid: false,
      errors: [
        {
          path: csvCellName(0, 0),
          message: "At least one row must be present",
        },
      ],
    }
  }

  const rows = data as string[][]
  const [headerColumns, headerRow, dataColumns, ...dataRows] = rows
  errors.push(...validateHeader(headerColumns, headerRow))
  errors.push(...validateColumns(dataColumns))
  if (errors.length > 1) {
    return {
      valid: false,
      errors: errors.map(csvErrorToValidationError).concat({
        path: csvCellName(0, 0),
        message: "Errors were seen in headers so rows were not evaluated",
      }),
    }
  }

  const tall = isTall(dataColumns)
  const indexOffset = 3
  errors.push(
    ...dataRows
      .filter((r) => !rowIsEmpty(r))
      .map((r) => cleanRowFields(objectFromKeysValues(dataColumns, r)))
      .flatMap((row: { [key: string]: string }, idx: number) =>
        validateRow(cleanRowFields(row), idx + indexOffset, dataColumns, !tall)
      )
  )

  return { valid, errors: errors.map(csvErrorToValidationError) }
}

/** @private */
export function validateHeader(
  columns: string[],
  row: string[]
): CsvValidationError[] {
  return [...validateHeaderColumns(columns), ...validateHeaderRow(row)]
}

/** @private */
export function validateHeaderColumns(columns: string[]): CsvValidationError[] {
  const rowIndex = 0
  const errors: CsvValidationError[] = []
  HEADER_COLUMNS.forEach((headerColumn, index) => {
    if (index < columns.length) {
      const LICENSE_STATE = "license_number | state"
      if (headerColumn === LICENSE_STATE) {
        const invalidMessage = `Header column is "${columns[index]}", it should be "license_number | <state>"`
        const splitColumn = columns[index].split("|").map((v) => v.trim())
        if (splitColumn.length !== 2) {
          errors.push(csvErr(rowIndex, index, LICENSE_STATE, invalidMessage))
          return
        }
        const stateCode = columns[index].split("|").slice(-1)[0].trim()
        if (!STATE_CODES.includes(stateCode as StateCode)) {
          errors.push(
            csvErr(
              rowIndex,
              index,
              LICENSE_STATE,
              `Header column "${columns[index]}" includes an invalid state code "${stateCode}"`
            )
          )
        } else if (
          !sepColumnsEqual(columns[index], `license_number | ${stateCode}`)
        ) {
          errors.push(csvErr(rowIndex, index, LICENSE_STATE, invalidMessage))
        }
        return
      }
      if (!sepColumnsEqual(columns[index], headerColumn)) {
        errors.push(
          csvErr(
            rowIndex,
            index,
            headerColumn,
            `Header column is "${columns[index]}", it should be "${headerColumn}"`,
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
          `Header column should be "${headerColumn}", but it is not present`
        )
      )
    }
  })
  return errors
}

/** @private */
export function validateHeaderRow(row: string[]): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  const rowIndex = 1

  if (row.length < HEADER_COLUMNS.length) {
    return [
      {
        row: rowIndex,
        column: 0,
        message: `${HEADER_COLUMNS.length} header fields are required and only ${row.length} are present`,
      },
    ]
  }

  const checkBlankColumns = [
    "hospital_name",
    "version",
    "hospital_location",
    "financial_aid_policy",
    "last_updated_on",
  ]
  const requiredColumns = ["last_updated_on"]
  checkBlankColumns.forEach((checkBlankColumn) => {
    const headerIndex = HEADER_COLUMNS.indexOf(checkBlankColumn)
    if (!row[headerIndex].trim()) {
      errors.push(
        csvErr(
          rowIndex,
          headerIndex,
          checkBlankColumn,
          `"${checkBlankColumn}" is blank`,
          !requiredColumns.includes(row[headerIndex].trim())
        )
      )
    }
  })

  const licenseStateIndex = HEADER_COLUMNS.findIndex((c) =>
    c.includes("license_number")
  )
  if (!row[licenseStateIndex].trim()) {
    errors.push(
      csvErr(
        rowIndex,
        licenseStateIndex,
        HEADER_COLUMNS[licenseStateIndex],
        `"${HEADER_COLUMNS[licenseStateIndex]}" is blank`,
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
        `Received ${columns.length} columns, less than the required number ${baseColumns.length}`
      ),
    ]
  }

  totalColumns.forEach((column, index) => {
    if (!sepColumnsEqual(columns[index], column)) {
      errors.push(
        csvErr(
          rowIndex,
          index,
          column,
          `Column is "${columns[index]}" and should be "${column}" for ${schemaFormat} format`
        )
      )
    }
  })

  if (!tall) {
    errors.push(...validateWideColumns(columns))
  }

  return errors
}

/** @private */
export function validateWideColumns(columns: string[]): CsvValidationError[] {
  const rowIndex = 2
  const errors: CsvValidationError[] = []
  const wideColumns = getWideColumns(columns)

  // TODO: incorporate order later on?
  wideColumns.forEach((column) => {
    if (!columns.some((c) => sepColumnsEqual(column, c))) {
      errors.push(csvErr(rowIndex, 0, column, `Missing column "${column}"`))
    }
  })

  if (columns[columns.length - 1] !== "additional_generic_notes") {
    errors.push(
      csvErr(
        rowIndex,
        columns.length - 1,
        "additional_generic_notes",
        `The last column should be "additional_generic_notes", is "${
          columns[columns.length - 1]
        }"`
      )
    )
  }

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

  const requiredFields = ["description", "code | 1"]
  requiredFields.forEach((field) =>
    errors.push(
      ...validateRequiredField(row, field, index, columns.indexOf(field))
    )
  )

  if (!BILLING_CODE_TYPES.includes(row["code | 1 | type"] as BillingCodeType)) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("code | 1 | type"),
        "code | 1 | type",
        `"code | 1 | type" value "${
          row["code | 1 | type"]
        }" is not one of the allowed values: ${BILLING_CODE_TYPES.map(
          (t) => `"${t}"`
        ).join(", ")}`,
        true
      )
    )
  }

  // TODO: Code itself is required, need to check all of those, not all checked here
  if (
    row["code | 2"] &&
    !BILLING_CODE_TYPES.includes(row["code | 2 | type"] as BillingCodeType)
  ) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("code | 2 | type"),
        "code | 2 | type",
        `"code | 2 | type" value "${
          row["code | 2 | type"]
        }" is not one of the allowed values: ${BILLING_CODE_TYPES.map(
          (t) => `"${t}"`
        ).join(", ")}`
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
        `"billing_class" value "${
          row["billing_class"]
        }" is not one of the allowed values: ${CHARGE_BILLING_CLASSES.map(
          (t) => `"${t}"`
        ).join(", ")}`
      )
    )
  }

  if (!CHARGE_SETTINGS.includes(row["setting"] as ChargeSetting)) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("setting"),
        "setting",
        `"setting" value "${
          row["setting"]
        }" is not one of the allowed values: ${CHARGE_SETTINGS.map(
          (t) => `"${t}"`
        ).join(", ")}`
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
          `"drug_unit_of_measurement" value "${row["drug_unit_of_measurement"]}" is not a valid number`
        )
      )
    }
    if (!DRUG_UNITS.includes(row["drug_type_of_measurement"] as DrugUnit)) {
      errors.push(
        csvErr(
          index,
          columns.indexOf("drug_type_of_measurement"),
          "drug_type_of_measurement",
          `"drug_type_of_measurement" value "${
            row["drug_type_of_measurement"]
          }" is not one of the allowed values: ${DRUG_UNITS.map(
            (t) => `"${t}"`
          ).join(", ")}`
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
          `"${field}" value "${value}" is not one of the allowed values: ${CONTRACTING_METHODS.map(
            (t) => `"${t}"`
          ).join(", ")}`
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
            `One of "${field.replace(
              " | percent",
              ""
            )}" or "${field}" is required`
          )
        )
      }
    }
  })
  return errors
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
      " (one of charge or percent is required)"
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
        `"standard_charge | contracting_method" value "${
          row["standard_charge | contracting_method"]
        }" is not one of the allowed values: ${CONTRACTING_METHODS.map(
          (t) => `"${t}"`
        ).join(", ")}`
      )
    )
  }

  return errors
}

function parseSepField(field: string): string[] {
  return field.split("|").map((v) => v.trim())
}

/** @private */
export function getBaseColumns(columns: string[]): string[] {
  const codeCount = getCodeCount(columns)
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

function getCodeCount(columns: string[]): number {
  return Math.max(
    0,
    ...columns
      .map((c) =>
        c
          .split("|")
          .map((v) => v.trim())
          .filter((v) => !!v)
      )
      .filter((c) => c[0] === "code" && c.length === 2)
      .map((c) => +c[1])
  )
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
      csvErr(rowIndex, columnIndex, field, `"${field}" is required${suffix}`),
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
        `"${field}" is required to be a positive number${suffix}`
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

function csvErrorToValidationError(err: CsvValidationError): ValidationError {
  return {
    path: csvCellName(err.row, err.column),
    field: err.field,
    message: err.message,
    ...(err.warning ? { warning: err.warning } : {}),
  }
}

// Helper to reduce boilerplate
function csvErr(
  row: number,
  column: number,
  field: string | undefined,
  message: string,
  warning?: boolean
): CsvValidationError {
  return { row, column, field, message, warning }
}

function cleanRowFields(row: { [key: string]: string }): {
  [key: string]: string
} {
  const newRow: { [key: string]: string } = {}
  Object.entries(row).forEach(([key, value]: string[]) => {
    newRow[
      key
        .split("|")
        .map((v) => v.trim())
        .join(" | ")
    ] = value
  })
  return newRow
}

function sepColumnsEqual(colA: string, colB: string) {
  const cleanA = colA.split("|").map((v) => v.trim())
  const cleanB = colB.split("|").map((v) => v.trim())
  return cleanA.every((a, idx: number) => a === cleanB[idx])
}

const ASCII_UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function csvCellName(row: number, column: number): string {
  return `${csvColumnName(column)}${row + 1}`
}

function csvColumnName(column: number): string {
  if (column < ASCII_UPPERCASE.length) return ASCII_UPPERCASE[column]

  return (
    ASCII_UPPERCASE[Math.floor(column / ASCII_UPPERCASE.length)] +
    csvColumnName(column % ASCII_UPPERCASE.length)
  )
}

function objectFromKeysValues(
  keys: string[],
  values: string[]
): { [key: string]: string } {
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
}

function rowIsEmpty(row: string[]): boolean {
  return row.every((value) => !value.trim())
}
