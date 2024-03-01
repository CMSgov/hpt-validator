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
  "license_number | state", // string, check for valid postal code in header
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
  ONE_OF_REQUIRED: (columns: string[], suffix = "") =>
    `at least one of ${columns
      .map((column) => `"${column}"`)
      .join(", ")} is required${suffix}`,
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
  const duplicateErrors: CsvValidationError[] = []
  columns.forEach((column, index) => {
    const matchingColumnIndex = remainingColumns.findIndex((requiredColumn) => {
      if (requiredColumn === "license_number | state") {
        // see if it works
        return validateLicenseStateColumn(column)
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
        duplicateErrors.push(
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
      ...duplicateErrors,
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

  const modifierPresent = (row["modifiers"] || "").trim().length > 0
  if (modifierPresent && !foundCode) {
    errors.push(...validateModifierRow(row, index, columns, wide))
    return errors
  }

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

  // Some conditional checks have date-dependent enforcement.
  const enforceConditionals = new Date().getFullYear() >= 2025
  // If code type is NDC, then the corresponding drug unit of measure and
  // drug type of measure data elements must be encoded. Required beginning 1/1/2025.
  const allCodeTypes = columns
    .filter((column) => {
      return /^code \| \d+ | type$/.test(column)
    })
    .map((codeTypeColumn) => row[codeTypeColumn])
  if (allCodeTypes.some((codeType) => matchesString(codeType, "NDC"))) {
    ;["drug_unit_of_measurement", "drug_type_of_measurement"].forEach(
      (field) => {
        errors.push(
          ...validateRequiredField(
            row,
            field,
            index,
            columns.indexOf(field),
            " when an NDC code is present"
          ).map((csvErr) => {
            csvErr.warning = !enforceConditionals
            return csvErr
          })
        )
      }
    )
  }

  if (wide) {
    errors.push(...validateWideFields(row, index, columns, foundCode))
  } else {
    errors.push(...validateTallFields(row, index, columns))
  }

  return errors
}

/** @private */
function validateModifierRow(
  row: { [key: string]: string },
  index: number,
  columns: string[],
  wide: boolean
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  // If a modifier is encoded without an item or service, then a description and one of the following
  // is the minimum information required:
  // additional_generic_notes, additional_payer_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm

  if (wide) {
    const payersPlans = getPayersPlans(columns)
    const payersPlansColumns: string[] = payersPlans
      .flatMap((payerPlan) => [
        ["standard_charge", ...payerPlan, "negotiated_dollar"],
        ["standard_charge", ...payerPlan, "negotiated_percentage"],
        ["standard_charge", ...payerPlan, "negotiated_algorithm"],
        ["additional_payer_notes", ...payerPlan],
      ])
      .map((c) => c.join(" | "))
    const modifierRequiredFields = [
      "additional_generic_notes",
      ...payersPlansColumns,
    ]
    errors.push(
      ...validateOneOfRequiredField(
        row,
        modifierRequiredFields,
        index,
        columns.indexOf(modifierRequiredFields[0]),
        " for wide format when a modifier is encoded without an item or service"
      )
    )
  } else {
    const modifierRequiredFields = [
      "additional_generic_notes",
      "standard_charge | negotiated_dollar",
      "standard_charge | negotiated_percentage",
      "standard_charge | negotiated_algorithm",
    ]
    errors.push(
      ...validateOneOfRequiredField(
        row,
        modifierRequiredFields,
        index,
        columns.indexOf(modifierRequiredFields[0]),
        " for tall format when a modifier is encoded without an item or service"
      )
    )
  }

  // other conditionals don't apply for modifier rows, but any values entered should still be the correct type
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
    ...validateOptionalEnumField(
      row,
      "setting",
      index,
      columns.indexOf("setting"),
      CHARGE_SETTINGS
    )
  )

  errors.push(
    ...validateOptionalFloatField(
      row,
      "drug_unit_of_measurement",
      index,
      columns.indexOf("drug_unit_of_measurement")
    )
  )
  errors.push(
    ...validateOptionalEnumField(
      row,
      "drug_type_of_measurement",
      index,
      columns.indexOf("drug_type_of_measurement"),
      DRUG_UNITS
    )
  )

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
    errors.push(...validateWideModifierFields(row, index, columns))
  } else {
    errors.push(...validateTallModifierFields(row, index, columns))
  }

  return errors
}

/** @private */
export function validateWideFields(
  row: { [key: string]: string },
  index: number,
  columns: string[],
  foundCodes: boolean
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  // TODO: Is checking that all are present covered in checking columns?
  // TODO: Is order maintained on entries? likely not
  columns.forEach((field, columnIndex) => {
    if (
      field.includes("contracting_method") &&
      !STANDARD_CHARGE_METHODOLOGY.includes(row[field] as StandardChargeMethod)
    ) {
      errors.push(
        csvErr(
          index,
          BASE_COLUMNS.length + columnIndex,
          field,
          ERRORS.ALLOWED_VALUES(
            field,
            row[field],
            STANDARD_CHARGE_METHODOLOGY as unknown as string[]
          )
        )
      )
    } else if (field.includes("standard_charge")) {
      if (
        field.includes(" | percent") &&
        !row[field].trim() &&
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

  // Some conditional checks have date-dependent enforcement.
  const enforceConditionals = new Date().getFullYear() >= 2025

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  const dollarChargeColumns = columns.filter((column) =>
    column.endsWith("| negotiated_dollar")
  )
  if (dollarChargeColumns.some((column) => row[column].trim().length > 0)) {
    ;["standard_charge | min", "standard_charge | max"].forEach((field) => {
      errors.push(
        ...validateRequiredField(
          row,
          field,
          index,
          columns.indexOf(field),
          " when a negotiated dollar amount is present"
        )
      )
    })
  }

  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.
  const payersPlans = getPayersPlans(columns)
  payersPlans.forEach(([payer, plan]) => {
    if (
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_dollar`] || ""
      ).trim().length === 0 &&
      ((
        row[`standard_charge | ${payer} | ${plan} | negotiated_percentage`] ||
        ""
      ).trim().length > 0 ||
        (
          row[`standard_charge | ${payer} | ${plan} | negotiated_algorithm`] ||
          ""
        ).trim().length > 0)
    ) {
      errors.push(
        ...validateRequiredFloatField(
          row,
          `estimated_amount | ${payer} | ${plan}`,
          index,
          columns.indexOf(`estimated_amount | ${payer} | ${plan}`),
          " when a negotiated percentage or algorithm is present, but negotiated dollar is not present"
        ).map((csvErr) => {
          csvErr.warning = !enforceConditionals
          return csvErr
        })
      )
    }
  })

  // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
  // then a corresponding valid value for the payer name, plan name, and standard charge methodology
  // must also be encoded.
  payersPlans.forEach(([payer, plan]) => {
    if (
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_dollar`] || ""
      ).trim().length > 0 ||
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_percentage`] || ""
      ).trim().length > 0 ||
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_algorithm`] || ""
      ).trim().length > 0
  ){
    errors.push(
      ...validateRequiredEnumField(
        row,
        `standard_charge | ${payer} | ${plan} | methodology`,
        index,
        columns.indexOf(`standard_charge | ${payer} | ${plan} | methodology`),
        STANDARD_CHARGE_METHODOLOGY
      )
    )
  }
  })

  // If the "standard charge methodology" encoded value is "other", there must be a
  // corresponding explanation found in the "additional notes" for the associated
  // payer-specific negotiated charge.
  payersPlans.forEach(([payer, plan]) => {
    if (
      (
        row[`standard_charge | ${payer} | ${plan} | methodology`] || ""
      ).trim().match("other")
    ) {
      errors.push(
        ...validateRequiredField(
          row,
          `additional_payer_notes | ${payer} | ${plan}`,
          index,
          columns.indexOf(`additional_payer_notes | ${payer} | ${plan}`),
          " additional_payer",
        ),
      )
    }
  })

  // If an item or service is encoded, a corresponding valid value must be encoded for
  // at least one of the following: "Gross Charge", "Discounted Cash Price",
  // "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
  // "Payer-Specific Negotiated Charge: Algorithm".
  payersPlans.forEach(([payer, plan]) => {
    if(
      foundCodes &&
      (row["standard_charge | gross"] || "").trim().length > 0 ||
      (row[`standard_charge | ${payer} | ${plan} | discounted_cash`] || "").trim().length > 0 ||
      (row[`standard_charge | ${payer} | ${plan} | negotiated_dollar`] || "").trim().length > 0 ||
      (row[`standard_charge | ${payer} | ${plan} | negotiated_percentage`] || "").trim().length > 0 ||
      (row[`standard_charge | ${payer} | ${plan} | negotiated_algorithm`] || "").trim().length > 0
    ){
      // ? validate a required row ?
    }
  })

  return errors
}

/** @private */
// checks the same fields as validateWideFields, but they are now optional
export function validateWideModifierFields(
  row: { [key: string]: string },
  index: number,
  columns: string[]
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  const payersPlans = getPayersPlans(columns)
  const floatChargeFields = payersPlans
    .flatMap((payerPlan) => [
      ["standard_charge", ...payerPlan, "negotiated_dollar"],
      ["standard_charge", ...payerPlan, "negotiated_percentage"],
    ])
    .map((c) => c.join(" | "))
  floatChargeFields.forEach((field) => {
    errors.push(
      ...validateOptionalFloatField(row, field, index, columns.indexOf(field))
    )
  })

  const methodologyFields = payersPlans.map((payerPlan) =>
    ["standard_charge", ...payerPlan, "methodology"].join(" | ")
  )
  methodologyFields.forEach((field) => {
    errors.push(
      ...validateOptionalEnumField(
        row,
        field,
        index,
        columns.indexOf(field),
        STANDARD_CHARGE_METHODOLOGY
      )
    )
  })

  return errors
}

function validateLicenseStateColumn(column: string): boolean {
  const splitColumn = column.split("|").map((v) => v.trim())
  if (splitColumn.length !== 2) {
    return false
  }
  const stateCode = column.split("|").slice(-1)[0].trim()
  if (!STATE_CODES.includes(stateCode.toUpperCase() as StateCode)) {
    return false
  } else if (!sepColumnsEqual(column, `license_number | ${stateCode}`)) {
    return false
  }
  return true
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

  const chargeFields = [
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percentage",
    "standard_charge | negotiated_algorithm",
  ]
  const oneOfChargeErrors = validateOneOfRequiredField(
    row,
    chargeFields,
    index,
    columns.indexOf("standard_charge | negotiated_dollar")
  )
  if (oneOfChargeErrors.length > 0) {
    errors.push(...oneOfChargeErrors)
  } else {
    const floatChargeFields = [
      "standard_charge | negotiated_dollar",
      "standard_charge | negotiated_percentage",
    ]
    floatChargeFields.forEach((field) => {
      errors.push(
        ...validateOptionalFloatField(row, field, index, columns.indexOf(field))
      )
    })
  }

  // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
  // then a corresponding valid value for the payer name, plan name, and standard charge methodology
  // must also be encoded.
  if (
    (row["standard_charge | negotiated_dollar"] || "").trim().length > 0 ||
    (row["standard_charge | negotiated_percentage"] || "").trim().length > 0 ||
    (row["standard_charge | negotiated_algorithm"] || "").trim().length > 0
  ){
    errors.push(
      ...validateRequiredField(
        row,
        "plan_name",
        index,
        columns.indexOf("plan_name"),
        " plan_name required"
      )
    )

    errors.push(
      ...validateRequiredField(
        row,
        "payer_name",
        index,
        columns.indexOf("payer_name"),
        " payer_name required"
      )
    )

    errors.push(
      ...validateRequiredEnumField(
        row,
        "standard_charge | methodology",
        index,
        columns.indexOf("standard_charge | methodology"),
        STANDARD_CHARGE_METHODOLOGY
      )
    )
  }

  //If the "standard charge methodology" encoded value is "other", there must be a
  // corresponding explanation found in the "additional notes" for the associated
  // payer-specific negotiated charge.
  const methodologyCols = columns
    .filter((column) => {
      return /^standard_charge \| methodology$/.test(column)
    })
    .map((methodologyColumn) => row[methodologyColumn])
  if (methodologyCols.some((methodology) => matchesString(methodology, "other"))){
    errors.push(
      ...validateRequiredField(
        row,
        "additional_generic_notes",
        index,
        columns.indexOf("additional_generic_notes"),
        ' additional_generic_notes required if methodology set to "other"'
      )
    )
  }
  // trying to accomplish conditional #3 same as above, better? only one necessary
  if ((row["standard_charge | negotiated_algorithm"] || "").match("other")){
        errors.push(
      ...validateRequiredField(
        row,
        "additional_generic_notes",
        index,
        columns.indexOf("additional_generic_notes"),
        ' additional_generic_notes required if methodology set to "other"'
      )
    )
  }

  // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
  // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount",
  // "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".
  const codeColumns = columns.filter((column) => {
    return /^code \| \d+$/.test(column)
  })
  let foundCode = false
  codeColumns.forEach((codeColumn) => {
    const codeTypeColumn = `${codeColumn} | type`

    if (row[codeTypeColumn] != null) {
      const trimCode = row[codeColumn].trim()
      const trimType = row[codeTypeColumn].trim()
      if(trimCode.length > 0 && trimType.length > 0){
        foundCode = true
        if (
          foundCode &&
          (row["standard_charge | gross"] || "").trim().length > 0 ||
          (row["standard_charge | discounted_cash"] || "").trim().length > 0 ||
          (row["standard_charge | negotiated_dollar"] || "").trim().length > 0 ||
          (row["standard_charge | negotiated_percentage"] || "").trim().length > 0 ||
          (row["standard_charge | negotiated_algorithm"] || "").trim().length > 0
        ){
          // ? validate required row ?
        }

      }
    }
  })

  // Conditional checks are here. Some have date-dependent enforcement.
  const enforceConditionals = new Date().getFullYear() >= 2025

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  // min and max have already been checked for valid float format, so this checks only if they are present.
  if ((row["standard_charge | negotiated_dollar"] || "").trim().length > 0) {
    ;["standard_charge | min", "standard_charge | max"].forEach((field) => {
      errors.push(
        ...validateRequiredField(
          row,
          field,
          index,
          columns.indexOf(field),
          " when a negotiated dollar amount is present"
        )
      )
    })
  }

  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.
  if (
    (row["standard_charge | negotiated_dollar"] || "").trim().length === 0 &&
    ((row["standard_charge | negotiated_percentage"] || "").trim().length > 0 ||
      (row["standard_charge | negotiated_algorithm"] || "").trim().length > 0)
  ) {
    errors.push(
      ...validateRequiredFloatField(
        row,
        "estimated_amount",
        index,
        columns.indexOf("estimated_amount"),
        " when a negotiated percentage or algorithm is present, but negotiated dollar is not present"
      ).map((csvErr) => {
        csvErr.warning = !enforceConditionals
        return csvErr
      })
    )
  }

  return errors
}

/** @private */
// checks the same fields as validateTallFields, but they are now optional
export function validateTallModifierFields(
  row: { [key: string]: string },
  index: number,
  columns: string[]
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  const floatChargeFields = [
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percentage",
  ]
  floatChargeFields.forEach((field) => {
    errors.push(
      ...validateOptionalFloatField(row, field, index, columns.indexOf(field))
    )
  })

  errors.push(
    ...validateOptionalEnumField(
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

function validateOneOfRequiredField(
  row: { [key: string]: string },
  fields: string[],
  rowIndex: number,
  columnIndex: number,
  suffix = ""
): CsvValidationError[] {
  if (
    fields.every((field) => {
      return (row[field] || "").trim().length === 0
    })
  ) {
    return [
      csvErr(
        rowIndex,
        columnIndex,
        fields[0],
        ERRORS.ONE_OF_REQUIRED(fields, suffix)
      ),
    ]
  }
  return []
}

function validateRequiredFloatField(
  row: { [key: string]: string },
  field: string,
  rowIndex: number,
  columnIndex: number,
  suffix = ""
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
