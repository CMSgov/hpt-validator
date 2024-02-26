import { CsvValidationError, StateCode, STATE_CODES } from "../../types.js"
import {
  csvErr,
  sepColumnsEqual,
  parseSepField,
  getCodeCount,
  isValidDate,
  matchesString,
} from "../common/csv.js"
import {
  BILLING_CODE_TYPES,
  CHARGE_BILLING_CLASSES,
  CHARGE_SETTINGS,
  STANDARD_CHARGE_METHODOLOGY,
  StandardChargeMethod,
  DRUG_UNITS,
} from "./types.js"

const ATTESTATION =
  "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated."

// headers must all be non-empty
export const HEADER_COLUMNS = [
  "hospital_name", // string
  "last_updated_on", // date
  "version", // string - maybe one of the known versions?
  "hospital_location", // string
  "hospital_address", // string
  "license_number | [state]", // string, check for valid postal code in header
  ATTESTATION, // "true"
] as const

export const BASE_COLUMNS = [
  "description", // non-empty string
  "setting", // one of CHARGE_SETTINGS
  "drug_unit_of_measurement", // positive number or blank
  "drug_type_of_measurement", // one of DRUG_UNITS or blank
  "modifiers", // string
  "standard_charge | gross", // positive number or blank
  "standard_charge | discounted_cash", // positive number or blank
  "standard_charge | min", // positive number or blank
  "standard_charge | max", // positive number or blank
  "additional_generic_notes", // string
]

export const OPTIONAL_COLUMNS = [
  "financial_aid_policy", // string
  "billing_class", // CHARGE_BILLING_CLASSES or blank
]

export const TALL_COLUMNS = [
  "payer_name", // string
  "plan_name", // string
  "standard_charge | negotiated_dollar", // positive number or blank
  "standard_charge | negotiated_percentage", // positive number or blank
  "standard_charge | negotiated_algorithm", // string
  "standard_charge | methodology", // one of CONTRACTING_METHODS or blank
  "estimated_amount", // positive number or blank
]

const ERRORS = {
  HEADER_COLUMN_MISSING: (column: string) =>
    `Header column should be "${column}", but it is not present`,
  HEADER_COLUMN_BLANK: (column: string) => `"${column}" is blank`,
  HEADER_STATE_CODE: (column: string, stateCode: string) =>
    `Header column "${column}" includes an invalid state code "${stateCode}"`,
  DUPLICATE_HEADER_COLUMN: (column: string) =>
    `Column ${column} duplicated in header`,
  COLUMN_MISSING: (column: string, format: string) =>
    `Column ${column} is missing, but it is required for ${format} format`,
  ALLOWED_VALUES: (
    column: string,
    value: string,
    allowedValues: readonly string[]
  ) =>
    `"${column}" value "${value}" is not one of the allowed values: ${allowedValues
      .map((t) => `"${t}"`)
      .join(", ")}`,
  INVALID_DATE: (column: string, value: string) =>
    `"${column}" value "${value}" is not a valid YYYY-MM-DD date`,
  INVALID_NUMBER: (column: string, value: string) =>
    `"${column}" value "${value}" is not a valid positive number`,
  POSITIVE_NUMBER: (column: string, suffix = ``) =>
    `"${column}" is required to be a positive number${suffix}`,
  CHARGE_ONE_REQUIRED: (column: string) => {
    const fieldName = column.replace(" | percent", "")
    return `One of "${fieldName}" or "${fieldName} | percent" is required`
  },
  CODE_ONE_REQUIRED: () => {
    return "At least one code and code type must be specified"
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
  const errors: CsvValidationError[] = []
  columns.forEach((column, index) => {
    const matchingColumnIndex = remainingColumns.findIndex((requiredColumn) => {
      if (requiredColumn === "license_number | [state]") {
        // make a best guess as to when a header is meant to be the license_number header
        // if it has two parts, and the first part matches, then the second part ought to be valid
        const splitColumn = column.split("|").map((v) => v.trim())
        if (splitColumn.length !== 2) {
          return false
        }
        if (sepColumnsEqual(splitColumn[0], "license_number")) {
          if (STATE_CODES.includes(splitColumn[1].toUpperCase() as StateCode)) {
            return true
          } else {
            errors.push(
              csvErr(
                rowIndex,
                index,
                requiredColumn,
                ERRORS.HEADER_STATE_CODE(column, splitColumn[1])
              )
            )
            return false
          }
        } else {
          return false
        }
      } else {
        return sepColumnsEqual(column, requiredColumn)
      }
    })
    if (matchingColumnIndex > -1) {
      discoveredColumns[index] = column
      remainingColumns.splice(matchingColumnIndex, 1)
    } else {
      // if we already found this column, it's a duplicate
      const existingColumn = discoveredColumns.find((discovered) => {
        return discovered != null && sepColumnsEqual(discovered, column)
      })
      if (existingColumn) {
        errors.push(
          csvErr(
            rowIndex,
            index,
            "column",
            ERRORS.DUPLICATE_HEADER_COLUMN(column)
          )
        )
      }
    }
  })
  return {
    errors: [
      ...errors,
      ...remainingColumns.map((requiredColumn) => {
        return csvErr(
          rowIndex,
          columns.length,
          requiredColumn,
          ERRORS.HEADER_COLUMN_MISSING(requiredColumn)
        )
      }),
    ],
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
      const value = row[index]?.trim() ?? ""
      if (!value) {
        errors.push(
          csvErr(rowIndex, index, header, ERRORS.HEADER_COLUMN_BLANK(header))
        )
      } else if (header === "last_updated_on" && !isValidDate(value)) {
        errors.push(
          csvErr(rowIndex, index, header, ERRORS.INVALID_DATE(header, value))
        )
      } else if (header === ATTESTATION && !matchesString(value, "true")) {
        errors.push(
          csvErr(
            rowIndex,
            index,
            "ATTESTATION",
            ERRORS.ALLOWED_VALUES("ATTESTATION", value, ["true"])
          )
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
  const schemaFormat = tall ? "tall" : "wide"
  const remainingColumns = baseColumns.concat(
    tall ? getTallColumns() : getWideColumns(columns)
  )

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

  const requiredFields = ["description"]
  requiredFields.forEach((field) =>
    errors.push(
      ...validateRequiredField(row, field, index, columns.indexOf(field))
    )
  )

  // check code and code-type columns
  const codeColumns = columns.filter((column) => {
    return /^code \| \d+$/.test(column)
  })
  let foundCode = false
  codeColumns.forEach((codeColumn) => {
    const codeTypeColumn = `${codeColumn} | type`
    // if the type column is missing, we already created an error when checking the columns
    // if both columns exist, we can check the values
    if (row[codeTypeColumn] != null) {
      const trimCode = row[codeColumn].trim()
      const trimType = row[codeTypeColumn].trim()
      if (trimCode.length === 0 && trimType.length > 0) {
        foundCode = true
        errors.push(
          csvErr(
            index,
            columns.indexOf(codeColumn),
            codeColumn,
            ERRORS.REQUIRED(codeColumn)
          )
        )
      } else if (trimCode.length > 0 && trimType.length === 0) {
        foundCode = true
        errors.push(
          csvErr(
            index,
            columns.indexOf(codeTypeColumn),
            codeTypeColumn,
            ERRORS.REQUIRED(codeTypeColumn)
          )
        )
      } else if (trimCode.length > 0 && trimType.length > 0) {
        foundCode = true
      }
      errors.push(
        ...validateOptionalEnumField(
          row,
          codeTypeColumn,
          index,
          columns.indexOf(codeTypeColumn),
          BILLING_CODE_TYPES
        )
      )
    }
  })
  if (!foundCode) {
    errors.push(
      csvErr(index, columns.length, "code | 1", ERRORS.CODE_ONE_REQUIRED())
    )
  }

  errors.push(
    ...validateOptionalEnumField(
      row,
      "billing_class",
      index,
      columns.indexOf("billing_class"),
      CHARGE_BILLING_CLASSES
    )
  )

  errors.push(
    ...validateRequiredEnumField(
      row,
      "setting",
      index,
      columns.indexOf("setting"),
      CHARGE_SETTINGS
    )
  )

  if ((row["drug_unit_of_measurement"] || "").trim()) {
    errors.push(
      ...validateOptionalFloatField(
        row,
        "drug_unit_of_measurement",
        index,
        columns.indexOf("drug_unit_of_measurement")
      )
    )
    errors.push(
      ...validateRequiredEnumField(
        row,
        "drug_type_of_measurement",
        index,
        columns.indexOf("drug_type_of_measurement"),
        DRUG_UNITS
      )
    )
    // if (!DRUG_UNITS.includes(row["drug_type_of_measurement"] as DrugUnit)) {
    //   errors.push(
    //     csvErr(
    //       index,
    //       columns.indexOf("drug_type_of_measurement"),
    //       "drug_type_of_measurement",
    //       ERRORS.ALLOWED_VALUES(
    //         "drug_type_of_measurement",
    //         row["drug_type_of_measurement"],
    //         DRUG_UNITS as unknown as string[]
    //       )
    //     )
    //   )
    // }
  }

  const chargeFields = [
    "standard_charge | gross",
    "standard_charge | discounted_cash",
    "standard_charge | min",
    "standard_charge | max",
  ]
  chargeFields.forEach((field) =>
    errors.push(
      ...validateOptionalFloatField(row, field, index, columns.indexOf(field))
    )
  )

  if (wide) {
    errors.push(...validateWideFields(row, index))
  } else {
    errors.push(...validateTallFields(row, index, columns))
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
      !STANDARD_CHARGE_METHODOLOGY.includes(value as StandardChargeMethod)
    ) {
      errors.push(
        csvErr(
          index,
          BASE_COLUMNS.length + columnIndex,
          field,
          ERRORS.ALLOWED_VALUES(
            field,
            value,
            STANDARD_CHARGE_METHODOLOGY as unknown as string[]
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
        BASE_COLUMNS.length + TALL_COLUMNS.indexOf(field)
      )
    )
  )

  // TODO: Only one of these has to be filled, clarify error
  const floatFields = [
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percentage",
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

  errors.push(
    ...validateRequiredEnumField(
      row,
      "standard_charge | methodology",
      index,
      columns.indexOf("standard_charge | methodology"),
      STANDARD_CHARGE_METHODOLOGY
    )
  )

  return errors
}

/** @private */
export function getBaseColumns(columns: string[]): string[] {
  const codeCount = Math.max(1, getCodeCount(columns))
  const codeColumns = Array(codeCount)
    .fill(0)
    .flatMap((_, i) => [`code | ${i + 1}`, `code | ${i + 1} | type`])

  return [...BASE_COLUMNS, ...codeColumns]
}

/** @private */
export function getWideColumns(columns: string[]): string[] {
  const payersPlans = getPayersPlans(columns)
  const payersPlansColumns: string[] = payersPlans
    .flatMap((payerPlan) => [
      ["standard_charge", ...payerPlan, "negotiated_dollar"],
      ["standard_charge", ...payerPlan, "negotiated_percentage"],
      ["standard_charge", ...payerPlan, "methodology"],
      ["standard_charge", ...payerPlan, "negotiated_algorithm"],
      ["estimated_amount", ...payerPlan], // turn into a warning
      ["additional_payer_notes", ...payerPlan],
    ])
    .map((c) => c.join(" | "))

  return payersPlansColumns
}

/** @private */
export function getTallColumns(): string[] {
  return TALL_COLUMNS
}

function getPayersPlans(columns: string[]): string[][] {
  const excludeSegments = [
    "standard_charge",
    "min",
    "max",
    "gross",
    "discounted_cash",
    "negotiated_dollar",
    "negotiated_percentage",
    "negotiated_algorithm",
    "methodology",
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
  if (!/^\d+(\.\d+)?$/g.test((row[field] || "").trim())) {
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

function validateOptionalFloatField(
  row: { [key: string]: string },
  field: string,
  rowIndex: number,
  columnIndex: number
): CsvValidationError[] {
  if (!(row[field] || "").trim()) {
    return []
  } else if (!/^\d+(\.\d+)?$/g.test(row[field].trim())) {
    return [
      csvErr(
        rowIndex,
        columnIndex,
        field,
        ERRORS.INVALID_NUMBER(field, row[field])
      ),
    ]
  }
  return []
}

function validateRequiredEnumField(
  row: { [key: string]: string },
  field: string,
  rowIndex: number,
  columnIndex: number,
  allowedValues: readonly string[]
) {
  if (!(row[field] || "").trim()) {
    return [csvErr(rowIndex, columnIndex, field, ERRORS.REQUIRED(field))]
  } else {
    const uppercaseValue = row[field].toUpperCase()
    if (
      !allowedValues.some((allowed) => allowed.toUpperCase() === uppercaseValue)
    ) {
      return [
        csvErr(
          rowIndex,
          columnIndex,
          field,
          ERRORS.ALLOWED_VALUES(field, row[field], allowedValues)
        ),
      ]
    }
  }
  return []
}

function validateOptionalEnumField(
  row: { [key: string]: string },
  field: string,
  rowIndex: number,
  columnIndex: number,
  allowedValues: readonly string[]
) {
  if (!(row[field] || "").trim()) {
    return []
  } else {
    const uppercaseValue = row[field].toUpperCase()
    if (
      !allowedValues.some((allowed) => allowed.toUpperCase() === uppercaseValue)
    ) {
      return [
        csvErr(
          rowIndex,
          columnIndex,
          field,
          ERRORS.ALLOWED_VALUES(field, row[field], allowedValues)
        ),
      ]
    }
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
