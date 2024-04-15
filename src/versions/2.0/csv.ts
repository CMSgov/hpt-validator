import { CsvValidationError, StateCode, STATE_CODES } from "../../types.js"
import {
  csvErr,
  sepColumnsEqual,
  parseSepField,
  getCodeCount,
  isValidDate,
  matchesString,
  objectFromKeysValues,
} from "../common/csv.js"
import {
  BILLING_CODE_TYPES,
  CHARGE_BILLING_CLASSES,
  CHARGE_SETTINGS,
  STANDARD_CHARGE_METHODOLOGY,
  DRUG_UNITS,
} from "./types.js"

const AFFIRMATION =
  "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated."

// headers must all be non-empty
export const HEADER_COLUMNS = [
  "hospital_name", // string
  "last_updated_on", // date
  "version", // string - maybe one of the known versions?
  "hospital_location", // string
  "hospital_address", // string
  "license_number | [state]", // string, check for valid postal code in header
  AFFIRMATION, // "true" or "false"
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

export const NEW_2025_COLUMNS = [
  "estimated_amount",
  "drug_unit_of_measurement",
  "drug_type_of_measurement",
  "modifiers",
]

const ERRORS = {
  HEADER_COLUMN_MISSING: (column: string) =>
    `Header column "${column}" is miscoded or missing. You must include this header and confirm that it is encoded as specified in the data dictionary.`,
  HEADER_COLUMN_BLANK: (column: string) =>
    `A value is required for "${column}". You must encode the missing information.`,
  HEADER_STATE_CODE: (stateCode: string) =>
    `${stateCode} is not an allowed value for state abbreviation. You must fill in the state or territory abbreviation even if there is no license number to encode. See the table found here for the list of valid values for state and territory abbreviations https://github.com/CMSgov/hospital-price-transparency/blob/master/documentation/CSV/state_codes.md`,
  DUPLICATE_HEADER_COLUMN: (column: string) =>
    `Column ${column} duplicated in header. You must review and revise your column headers so that each header appears only once in the first row.`,
  COLUMN_MISSING: (column: string) =>
    `Column ${column} is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.`,
  DUPLICATE_COLUMN: (column: string) =>
    `Column ${column} duplicated in header. You must review and revise your column headers so that each header appears only once in the third row.`,
  ALLOWED_VALUES: (
    column: string,
    value: string,
    allowedValues: readonly string[]
  ) =>
    `"${column}" value "${value}" is not one of the allowed valid values. You must encode one of these valid values: ${allowedValues.join(
      ", "
    )}`,
  INVALID_DATE: (column: string, value: string) =>
    `"${column}" value "${value}" is not in a valid ISO 8601 format. You must encode the date using this format: YYYY-MM-DD`,
  INVALID_NUMBER: (column: string, value: string) =>
    `"${column}" value "${value}" is not a positive number. You must encode a positive, non-zero, numeric value.`,
  POSITIVE_NUMBER: (column: string, value: string) =>
    `"${column}" value "${value}" is not a positive number. You must encode a positive, non-zero, numeric value.`,
  CHARGE_ONE_REQUIRED: (column: string) => {
    const fieldName = column.replace(" | percent", "")
    return `One of "${fieldName}" or "${fieldName} | percent" is required`
  },
  CODE_ONE_REQUIRED: () => {
    return "If a standard charge is encoded, there must be a corresponding code and code type pairing. The code and code type pairing do not need to be in the first code and code type columns (i.e., code|1 and code|1|type)."
  },
  REQUIRED: (column: string, suffix = ``) =>
    `A value is required for "${column}"${suffix}. You must encode the missing information.`,
  ONE_OF_REQUIRED: (columns: string[], suffix = "") =>
    `at least one of ${columns
      .map((column) => `"${column}"`)
      .join(", ")} is required${suffix}`,
  DOLLAR_MIN_MAX: () =>
    'If there is a "payer specific negotiated charge" encoded as a dollar amount, there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.',
  PERCENTAGE_ALGORITHM_ESTIMATE: () =>
    'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.',
  NDC_DRUG_MEASURE: () =>
    "If code type is NDC, then the corresponding drug unit of measure and drug type of measure data element must be encoded.",
  MODIFIER_EXTRA_INFO: () =>
    "If a modifier is encoded without an item or service, then a description and one of the following is the minimum information required: additional_payer_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm.",
  OTHER_METHODOLOGY_NOTES: () =>
    'If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found in the "additional notes" for the associated payer-specific negotiated charge.',
  ITEM_REQUIRES_CHARGE: () =>
    'If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following: "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".',
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
  columns: string[]
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
                ERRORS.HEADER_STATE_CODE(splitColumn[1])
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
          -1,
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
  headers: string[],
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
      } else if (header === AFFIRMATION) {
        errors.push(
          ...validateRequiredEnumField(
            objectFromKeysValues(headers, row),
            header,
            rowIndex,
            index,
            ["true", "false"]
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
  const remainingColumns = baseColumns.concat(
    tall ? getTallColumns() : getWideColumns(columns)
  )
  const enforce2025 = new Date().getFullYear() >= 2025
  const discoveredColumns: string[] = []
  const duplicateErrors: CsvValidationError[] = []

  columns.forEach((column, index) => {
    const matchingColumnIndex = remainingColumns.findIndex((requiredColumn) =>
      sepColumnsEqual(column, requiredColumn)
    )
    if (matchingColumnIndex > -1) {
      discoveredColumns[index] = column
      remainingColumns.splice(matchingColumnIndex, 1)
    } else {
      const existingColumn = discoveredColumns.find((discovered) => {
        return discovered != null && sepColumnsEqual(discovered, column)
      })
      if (existingColumn) {
        duplicateErrors.push(
          csvErr(rowIndex, index, "column", ERRORS.DUPLICATE_COLUMN(column))
        )
      }
    }
  })

  return [
    ...duplicateErrors,
    ...remainingColumns.map((requiredColumn) => {
      const problem = csvErr(
        rowIndex,
        -1,
        requiredColumn,
        ERRORS.COLUMN_MISSING(requiredColumn)
      )
      if (
        !enforce2025 &&
        (NEW_2025_COLUMNS.includes(requiredColumn) ||
          requiredColumn.startsWith("estimated_amount |"))
      ) {
        problem.warning = true
      }
      return problem
    }),
  ]
}

/** @private */
export function validateRow(
  row: { [key: string]: string },
  index: number,
  columns: string[],
  wide = false
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  // Some columns and conditional checks have date-dependent enforcement.
  const enforce2025 = new Date().getFullYear() >= 2025

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

  if (
    (row["drug_unit_of_measurement"] || "").trim() ||
    (row["drug_type_of_measurement"] || "").trim()
  ) {
    errors.push(
      ...validateRequiredFloatField(
        row,
        "drug_unit_of_measurement",
        index,
        columns.indexOf("drug_unit_of_measurement"),
        ' when "drug_type_of_measurement" is present'
      ).map((err) => (enforce2025 ? err : { ...err, warning: true }))
    )
    errors.push(
      ...validateRequiredEnumField(
        row,
        "drug_type_of_measurement",
        index,
        columns.indexOf("drug_type_of_measurement"),
        DRUG_UNITS,
        ' when "drug_unit_of_measurement" is present'
      ).map((err) => (enforce2025 ? err : { ...err, warning: true }))
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

  // If code type is NDC, then the corresponding drug unit of measure and
  // drug type of measure data elements must be encoded. Required beginning 1/1/2025.
  const allCodeTypes = columns
    .filter((column) => {
      return /^code \| \d+ | type$/.test(column)
    })
    .map((codeTypeColumn) => row[codeTypeColumn])
  if (allCodeTypes.some((codeType) => matchesString(codeType, "NDC"))) {
    const invalidFields = [
      "drug_unit_of_measurement",
      "drug_type_of_measurement",
    ].filter((field) => {
      return (
        validateRequiredField(row, field, index, columns.indexOf(field))
          .length > 0
      )
    })
    if (invalidFields.length > 0) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(invalidFields[0]),
          invalidFields[0],
          ERRORS.NDC_DRUG_MEASURE(),
          !enforce2025
        )
      )
    }
  }

  if (wide) {
    errors.push(...validateWideFields(row, index, columns, foundCode))
  } else {
    errors.push(...validateTallFields(row, index, columns, foundCode))
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
  const enforce2025 = new Date().getFullYear() >= 2025
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
    if (
      validateOneOfRequiredField(
        row,
        modifierRequiredFields,
        index,
        columns.indexOf(modifierRequiredFields[0]),
        " for wide format when a modifier is encoded without an item or service"
      ).length > 0
    ) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(modifierRequiredFields[0]),
          modifierRequiredFields[0],
          ERRORS.MODIFIER_EXTRA_INFO()
        )
      )
    }
  } else {
    const modifierRequiredFields = [
      "additional_generic_notes",
      "standard_charge | negotiated_dollar",
      "standard_charge | negotiated_percentage",
      "standard_charge | negotiated_algorithm",
    ]
    if (
      validateOneOfRequiredField(
        row,
        modifierRequiredFields,
        index,
        columns.indexOf(modifierRequiredFields[0]),
        " for tall format when a modifier is encoded without an item or service"
      ).length > 0
    ) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(modifierRequiredFields[0]),
          modifierRequiredFields[0],
          ERRORS.MODIFIER_EXTRA_INFO()
        )
      )
    }
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
    ).map((err) => (enforce2025 ? err : { ...err, warning: true }))
  )
  errors.push(
    ...validateOptionalEnumField(
      row,
      "drug_type_of_measurement",
      index,
      columns.indexOf("drug_type_of_measurement"),
      DRUG_UNITS
    ).map((err) => (enforce2025 ? err : { ...err, warning: true }))
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
  foundCode: boolean
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  // Some conditional checks have date-dependent enforcement.
  const enforceConditionals = new Date().getFullYear() >= 2025
  const payersPlans = getPayersPlans(columns)

  // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
  // then a corresponding valid value for the payer name, plan name, and standard charge methodology
  // must also be encoded.
  payersPlans.forEach(([payer, plan]) => {
    if (
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_dollar`] || ""
      ).trim().length > 0 ||
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_percentage`] ||
        ""
      ).trim().length > 0 ||
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_algorithm`] || ""
      ).trim().length > 0
    ) {
      errors.push(
        ...validateRequiredEnumField(
          row,
          `standard_charge | ${payer} | ${plan} | methodology`,
          index,
          columns.indexOf(`standard_charge | ${payer} | ${plan} | methodology`),
          STANDARD_CHARGE_METHODOLOGY,
          " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
        )
      )
    } else {
      // if it's not required, check that the value is valid
      errors.push(
        ...validateOptionalEnumField(
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
      (row[`standard_charge | ${payer} | ${plan} | methodology`] || "")
        .trim()
        .match("other")
    ) {
      if (
        validateRequiredField(
          row,
          `additional_payer_notes | ${payer} | ${plan}`,
          index,
          columns.indexOf(`additional_payer_notes | ${payer} | ${plan}`)
        ).length > 0
      ) {
        errors.push(
          csvErr(
            index,
            columns.indexOf(`additional_payer_notes | ${payer} | ${plan}`),
            `additional_payer_notes | ${payer} | ${plan}`,
            ERRORS.OTHER_METHODOLOGY_NOTES()
          )
        )
      }
    }
  })

  // If an item or service is encoded, a corresponding valid value must be encoded for
  // at least one of the following: "Gross Charge", "Discounted Cash Price",
  // "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage",
  // "Payer-Specific Negotiated Charge: Algorithm".
  if (foundCode) {
    const payerPlanChargeColumns = payersPlans
      .flatMap((payerPlan) => [
        ["standard_charge", ...payerPlan, "negotiated_dollar"],
        ["standard_charge", ...payerPlan, "negotiated_percentage"],
        ["standard_charge", ...payerPlan, "negotiated_algorithm"],
      ])
      .map((c) => c.join(" | "))
    const chargeColumns = [
      "standard_charge | gross",
      "standard_charge | discounted_cash",
      ...payerPlanChargeColumns,
    ]
    const itemHasCharge =
      validateOneOfRequiredField(
        row,
        chargeColumns,
        index,
        columns.indexOf(chargeColumns[0])
      ).length === 0
    if (!itemHasCharge) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(chargeColumns[0]),
          chargeColumns[0],
          ERRORS.ITEM_REQUIRES_CHARGE()
        )
      )
    }
  }

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  const dollarChargeColumns = columns.filter((column) =>
    column.endsWith("| negotiated_dollar")
  )
  if (dollarChargeColumns.some((column) => row[column].trim().length > 0)) {
    const invalidFields = [
      "standard_charge | min",
      "standard_charge | max",
    ].filter((field) => {
      return (
        validateRequiredField(row, field, index, columns.indexOf(field))
          .length > 0
      )
    })
    if (invalidFields.length > 0) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(invalidFields[0]),
          invalidFields[0],
          ERRORS.DOLLAR_MIN_MAX()
        )
      )
    }
  }

  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.

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
      const estimatedField = `estimated_amount | ${payer} | ${plan}`
      if (
        validateRequiredFloatField(
          row,
          estimatedField,
          index,
          columns.indexOf(estimatedField)
        ).length > 0
      ) {
        errors.push(
          csvErr(
            index,
            columns.indexOf(estimatedField),
            estimatedField,
            ERRORS.PERCENTAGE_ALGORITHM_ESTIMATE(),
            !enforceConditionals
          )
        )
      }
    }
  })

  // Ensuring that the numeric values are greater than zero.
  payersPlans.forEach(([payer, plan]) => {
    if (
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_dollar`] || ""
      ).trim().length > 0 &&
      validateRequiredFloatField(
        row,
        `standard_charge | ${payer} | ${plan} | negotiated_dollar`,
        index,
        columns.indexOf(
          `standard_charge | ${payer} | ${plan} | negotiated_dollar`
        )
      ).length > 0
    ) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(
            `standard_charge | ${payer} | ${plan} | negotiated_dollar`
          ),
          `standard_charge | ${payer} | ${plan} | negotiated_dollar`,
          ERRORS.INVALID_NUMBER(
            `standard_charge | ${payer} | ${plan} | negotiated_dollar`,
            row[`standard_charge | ${payer} | ${plan} | negotiated_dollar`]
          )
        )
      )
    }

    if (
      (
        row[`standard_charge | ${payer} | ${plan} | negotiated_percentage`] ||
        ""
      ).trim().length > 0 &&
      validateRequiredFloatField(
        row,
        `standard_charge | ${payer} | ${plan} | negotiated_percentage`,
        index,
        columns.indexOf(
          `standard_charge | ${payer} | ${plan} | negotiated_percentage`
        )
      ).length > 0
    ) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(
            `standard_charge | ${payer} | ${plan} | negotiated_percentage`
          ),
          `standard_charge | ${payer} | ${plan} | negotiated_percentage`,
          ERRORS.INVALID_NUMBER(
            `standard_charge | ${payer} | ${plan} | negotiated_percentage`,
            row[`standard_charge | ${payer} | ${plan} | negotiated_percentage`]
          )
        )
      )
    }

    if (
      (row[`estimated_amount | ${payer} | ${plan}`] || "").trim().length > 0 &&
      validateRequiredFloatField(
        row,
        `estimated_amount | ${payer} | ${plan}`,
        index,
        columns.indexOf(`estimated_amount | ${payer} | ${plan}`)
      ).length > 0
    ) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(`estimated_amount | ${payer} | ${plan}`),
          `estimated_amount | ${payer} | ${plan}`,
          ERRORS.INVALID_NUMBER(
            `estimated_amount | ${payer} | ${plan}`,
            row[`estimated_amount | ${payer} | ${plan}`]
          ),
          !enforceConditionals
        )
      )
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

/** @private */
export function validateTallFields(
  row: { [key: string]: string },
  index: number,
  columns: string[],
  foundCode: boolean
): CsvValidationError[] {
  const errors: CsvValidationError[] = []
  const enforce2025 = new Date().getFullYear() >= 2025
  // first, some type checks
  const floatChargeFields = [
    "standard_charge | negotiated_dollar",
    "standard_charge | negotiated_percentage",
  ]
  floatChargeFields.forEach((field) => {
    errors.push(
      ...validateOptionalFloatField(row, field, index, columns.indexOf(field))
    )
  })

  // Conditional checks are here. Some have date-dependent enforcement.
  const enforceConditionals = new Date().getFullYear() >= 2025

  // If a "payer specific negotiated charge" is encoded as a dollar amount, percentage, or algorithm
  // then a corresponding valid value for the payer name, plan name, and standard charge methodology
  // must also be encoded.
  if (
    (row["standard_charge | negotiated_dollar"] || "").trim().length > 0 ||
    (row["standard_charge | negotiated_percentage"] || "").trim().length > 0 ||
    (row["standard_charge | negotiated_algorithm"] || "").trim().length > 0
  ) {
    errors.push(
      ...validateRequiredField(
        row,
        "payer_name",
        index,
        columns.indexOf("payer_name"),
        " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
      )
    )

    errors.push(
      ...validateRequiredField(
        row,
        "plan_name",
        index,
        columns.indexOf("plan_name"),
        " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
      )
    )

    errors.push(
      ...validateRequiredEnumField(
        row,
        "standard_charge | methodology",
        index,
        columns.indexOf("standard_charge | methodology"),
        STANDARD_CHARGE_METHODOLOGY,
        " when a payer specific negotiated charge is encoded as a dollar amount, percentage, or algorithm"
      )
    )
  }

  //If the "standard charge methodology" encoded value is "other", there must be a
  // corresponding explanation found in the "additional notes" for the associated
  // payer-specific negotiated charge.
  if (
    matchesString(
      (row["standard_charge | methodology"] || "").trim(),
      "other"
    ) &&
    !(row["additional_generic_notes"] || "").trim()
  ) {
    errors.push(
      csvErr(
        index,
        columns.indexOf("additional_generic_notes"),
        "additional_generic_notes",
        ERRORS.OTHER_METHODOLOGY_NOTES()
      )
    )
  }

  // If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following:
  // "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount",
  // "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".

  if (foundCode) {
    const itemHasCharge =
      validateOneOfRequiredField(
        row,
        [
          "standard_charge | gross",
          "standard_charge | discounted_cash",
          "standard_charge | negotiated_dollar",
          "standard_charge | negotiated_percentage",
          "standard_charge | negotiated_algorithm",
        ],
        index,
        columns.indexOf("standard_charge | gross")
      ).length === 0
    if (!itemHasCharge) {
      errors.push(
        csvErr(
          index,
          columns.indexOf("standard_charge | gross"),
          "standard_charge | gross",
          ERRORS.ITEM_REQUIRES_CHARGE()
        )
      )
    }
  }

  // If there is a "payer specific negotiated charge" encoded as a dollar amount,
  // there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
  // min and max have already been checked for valid float format, so this checks only if they are present.
  if ((row["standard_charge | negotiated_dollar"] || "").trim().length > 0) {
    const invalidFields = [
      "standard_charge | min",
      "standard_charge | max",
    ].filter((field) => {
      return (
        validateRequiredField(row, field, index, columns.indexOf(field))
          .length > 0
      )
    })
    if (invalidFields.length > 0) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(invalidFields[0]),
          invalidFields[0],
          ERRORS.DOLLAR_MIN_MAX()
        )
      )
    }
  }

  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.
  if (
    (row["standard_charge | negotiated_dollar"] || "").trim().length === 0 &&
    ((row["standard_charge | negotiated_percentage"] || "").trim().length > 0 ||
      (row["standard_charge | negotiated_algorithm"] || "").trim().length > 0)
  ) {
    const estimatedField = `estimated_amount`
    if (
      validateRequiredFloatField(
        row,
        estimatedField,
        index,
        columns.indexOf(estimatedField)
      ).length > 0
    ) {
      errors.push(
        csvErr(
          index,
          columns.indexOf(estimatedField),
          estimatedField,
          ERRORS.PERCENTAGE_ALGORITHM_ESTIMATE(),
          !enforceConditionals
        )
      )
    }
  } else {
    errors.push(
      ...validateOptionalFloatField(
        row,
        "estimated_amount",
        index,
        columns.indexOf("estimated_amount")
      ).map((err) => (enforce2025 ? err : { ...err, warning: true }))
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
  if (!(row[field] || "").trim()) {
    return [
      csvErr(rowIndex, columnIndex, field, ERRORS.REQUIRED(field, suffix)),
    ]
    // We wrap the three alternative patterns (\d+\.\d+|\.\d+|\d+) within a non-capturing group (?: ... ). This group acts as a container but doesn't capture any matched text during the regex search.
  } else if (
    !/^(?:\d+\.\d+|\.\d+|\d+)$/g.test(row[field].trim()) ||
    parseFloat(row[field].trim()) <= 0
  ) {
    return [
      csvErr(
        rowIndex,
        columnIndex,
        field,
        ERRORS.POSITIVE_NUMBER(field, row[field])
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
  } else if (
    !/^(?:\d+\.\d+|\.\d+|\d+)$/g.test(row[field].trim()) ||
    parseFloat(row[field].trim()) <= 0
  ) {
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
  allowedValues: readonly string[],
  suffix = ""
) {
  if (!(row[field] || "").trim()) {
    return [
      csvErr(rowIndex, columnIndex, field, ERRORS.REQUIRED(field, suffix)),
    ]
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
    if (!allowedValues.some((allowed) => matchesString(row[field], allowed))) {
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
