import Ajv, { ErrorObject } from "ajv"
import addFormats from "ajv-formats"
import { JSONParser } from "@streamparser/json"

import {
  JsonValidatorOptions,
  STATE_CODES,
  ValidationError,
  ValidationResult,
} from "../../types.js"
import {
  BILLING_CODE_TYPES,
  CHARGE_SETTINGS,
  DRUG_UNITS,
  STANDARD_CHARGE_METHODOLOGY,
} from "./types.js"
import { errorObjectToValidationError, parseJson } from "../common/json.js"
import { addErrorsToList } from "../../utils.js"

const STANDARD_CHARGE_DEFINITIONS = {
  code_information: {
    type: "object",
    properties: {
      code: { type: "string", minLength: 1 },
      type: {
        enum: BILLING_CODE_TYPES,
        type: "string",
      },
    },
    required: ["code", "type"],
  },
  drug_information: {
    type: "object",
    properties: {
      unit: { type: "string", minLength: 1 },
      type: { enum: DRUG_UNITS, type: "string" },
    },
    required: ["unit", "type"],
  },

  standard_charges: {
    type: "object",
    properties: {
      minimum: { type: "number", exclusiveMinimum: 0 },
      maximum: { type: "number", exclusiveMinimum: 0 },
      gross_charge: { type: "number", exclusiveMinimum: 0 },
      discounted_cash: { type: "number", exclusiveMinimum: 0 },
      setting: {
        enum: CHARGE_SETTINGS,
        type: "string",
      },
      payers_information: {
        type: "array",
        items: { $ref: "#/definitions/payers_information" },
        minItems: 1,
      },
      additional_generic_notes: { type: "string" },
    },
    required: ["setting"],
    anyOf: [
      { type: "object", required: ["gross_charge"] },
      { type: "object", required: ["discounted_cash"] },
      {
        type: "object",
        properties: {
          payers_information: {
            type: "array",
            items: {
              anyOf: [
                { type: "object", required: ["standard_charge_dollar"] },
                { type: "object", required: ["standard_charge_algorithm"] },
                { type: "object", required: ["standard_charge_percentage"] },
              ],
            },
          },
        },
        required: ["payers_information"],
      },
    ],
    if: {
      type: "object",
      properties: {
        payers_information: {
          type: "array",
          contains: {
            type: "object",
            required: ["standard_charge_dollar"],
          },
        },
      },
      required: ["payers_information"],
    },
    then: {
      required: ["minimum", "maximum"],
    },
  },
  standard_charge_information: {
    type: "object",
    properties: {
      description: { type: "string", minLength: 1 },
      drug_information: { $ref: "#/definitions/drug_information" },
      code_information: {
        type: "array",
        items: { $ref: "#/definitions/code_information" },
        minItems: 1,
      },
      standard_charges: {
        type: "array",
        items: { $ref: "#/definitions/standard_charges" },
        minItems: 1,
      },
    },
    required: ["description", "code_information", "standard_charges"],
    if: {
      type: "object",
      properties: {
        code_information: {
          type: "array",
          contains: {
            type: "object",
            properties: {
              type: {
                const: "NDC",
              },
            },
          },
        },
      },
    },
    then: {
      required: ["drug_information"],
    },
  },
  payers_information: {
    type: "object",
    properties: {
      payer_name: { type: "string", minLength: 1 },
      plan_name: { type: "string", minLength: 1 },
      additional_payer_notes: { type: "string" },
      standard_charge_dollar: { type: "number", exclusiveMinimum: 0 },
      standard_charge_algorithm: { type: "string" },
      standard_charge_percentage: { type: "number", exclusiveMinimum: 0 },
      estimated_amount: { type: "number", exclusiveMinimum: 0 },
      methodology: {
        enum: STANDARD_CHARGE_METHODOLOGY,
        type: "string",
      },
    },
    required: ["payer_name", "plan_name", "methodology"],
    allOf: [
      {
        if: {
          properties: {
            methodology: {
              const: "other",
            },
          },
          required: ["methodology"],
        },
        then: {
          properties: {
            additional_payer_notes: { type: "string", minLength: 1 },
          },
          required: ["additional_payer_notes"],
        },
      },
      {
        if: {
          anyOf: [
            { required: ["standard_charge_percentage"] },
            { required: ["standard_charge_algorithm"] },
          ],
          not: {
            required: ["standard_charge_dollar"],
          },
        },
        then: {
          required: ["estimated_amount"], // Required beginning 1/1/2025
        },
      },
    ],
  },
}

const STANDARD_CHARGE_PROPERTIES = {
  type: "object",
  properties: {
    description: { type: "string", minLength: 1 },
    drug_information: { $ref: "#/definitions/drug_information" },
    code_information: {
      type: "array",
      items: { $ref: "#/definitions/code_information" },
      minItems: 1,
    },
    standard_charges: {
      type: "array",
      items: { $ref: "#/definitions/standard_charges" },
      minItems: 1,
    },
  },
  required: ["description", "code_information", "standard_charges"],

  if: {
    type: "object",
    properties: {
      code_information: {
        type: "array",
        contains: {
          type: "object",
          properties: {
            type: {
              const: "NDC",
            },
          },
        },
      },
    },
  },
  then: {
    required: ["drug_information"],
  },
}

export const STANDARD_CHARGE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: STANDARD_CHARGE_DEFINITIONS,
  ...STANDARD_CHARGE_PROPERTIES,
}

export const METADATA_DEFINITIONS = {
  license_information: {
    type: "object",
    properties: {
      license_number: { type: "string" },
      state: {
        enum: STATE_CODES,
        type: "string",
      },
    },
    required: ["state"],
  },
  affirmation: {
    type: "object",
    properties: {
      affirmation: {
        const:
          "To the best of its knowledge and belief, the hospital has included all applicable standard charge information in accordance with the requirements of 45 CFR 180.50, and the information encoded is true, accurate, and complete as of the date indicated.",
      },
      confirm_affirmation: {
        type: "boolean",
      },
    },
    required: ["affirmation", "confirm_affirmation"],
  },
  modifier_information: {
    type: "object",
    properties: {
      description: {
        type: "string",
        minLength: 1,
      },
      code: {
        type: "string",
        minLength: 1,
      },
      modifier_payer_information: {
        type: "array",
        items: {
          $ref: "#/definitions/modifier_payer_information",
        },
        minItems: 1,
      },
    },
    required: ["description", "modifier_payer_information", "code"],
  },
  modifier_payer_information: {
    type: "object",
    properties: {
      payer_name: {
        type: "string",
        minLength: 1,
      },
      plan_name: {
        type: "string",
        minLength: 1,
      },
      description: {
        type: "string",
        minLength: 1,
      },
      setting: {
        enum: CHARGE_SETTINGS,
        type: "string",
      },
    },
    required: ["payer_name", "plan_name", "description"],
  },
}

export const METADATA_PROPERTIES = {
  hospital_name: { type: "string", minLength: 1 },
  last_updated_on: { type: "string", format: "date" },
  license_information: {
    $ref: "#/definitions/license_information",
  },
  version: { type: "string", minLength: 1 },
  hospital_address: {
    type: "array",
    items: { type: "string" },
    minItems: 1,
  },
  hospital_location: {
    type: "array",
    items: {
      type: "string",
    },
    minItems: 1,
  },
  affirmation: {
    $ref: "#/definitions/affirmation",
  },
  modifier_information: {
    type: "array",
    items: {
      $ref: "#/definitions/modifier_information",
    },
  },
}

export const METADATA_REQUIRED = [
  "hospital_name",
  "last_updated_on",
  "hospital_location",
  "hospital_address",
  "license_information",
  "version",
  "affirmation",
]

export const METADATA_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: METADATA_DEFINITIONS,
  type: "object",
  properties: METADATA_PROPERTIES,
  required: METADATA_REQUIRED,
}

export const JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: {
    ...METADATA_DEFINITIONS,
    ...STANDARD_CHARGE_DEFINITIONS,
    standard_charge_information: STANDARD_CHARGE_PROPERTIES,
  },
  type: "object",
  properties: {
    ...METADATA_PROPERTIES,
    standard_charge_information: {
      type: "array",
      items: { $ref: "#/definitions/standard_charge_information" },
      minItems: 1,
    },
  },
  required: [...METADATA_REQUIRED, "standard_charge_information"],
}

export async function validateJson(
  jsonInput: File | NodeJS.ReadableStream,
  options: JsonValidatorOptions = {}
): Promise<ValidationResult> {
  const validator = new Ajv({ allErrors: true })
  addFormats(validator)
  const parser = new JSONParser({
    paths: [
      "$.hospital_name",
      "$.last_updated_on",
      "$.license_information",
      "$.version",
      "$.hospital_address",
      "$.hospital_location",
      "$.affirmation",
      "$.modifier_information",
      "$.standard_charge_information.*",
    ],
    keepStack: false,
  })
  const metadata: { [key: string]: any } = {}
  let valid = true
  let hasCharges = false
  const errors: ValidationError[] = []
  const enforce2025 = new Date().getFullYear() >= 2025
  const counts = {
    errors: 0,
    warnings: 0,
  }

  return new Promise(async (resolve) => {
    // TODO: currently this is still storing the full array of items in "parent", but we
    // would need to override some internals to get around that
    parser.onValue = ({ value, key, stack }) => {
      if (stack.length > 2 || key === "standard_charge_information") return
      if (typeof key === "string") {
        metadata[key] = value
      } else {
        // is this where I need to put another check for the modifier information?
        hasCharges = true
        if (!validator.validate(STANDARD_CHARGE_SCHEMA, value)) {
          const validationErrors = (validator.errors as ErrorObject[])
            .map(
              enforce2025
                ? errorObjectToValidationError
                : errorObjectToValidationErrorWithWarnings
            )
            .map((error) => {
              const pathPrefix = stack
                .filter((se) => se.key)
                .map((se) => se.key)
                .join("/")
              return {
                ...error,
                path: `/${pathPrefix}/${key}${error.path}`,
              }
            })
          addErrorsToList(validationErrors, errors, options.maxErrors, counts)
          valid = counts.errors === 0
        }
        if (options.onValueCallback && value != null) {
          options.onValueCallback(value)
        }
        if (
          options.maxErrors &&
          options.maxErrors > 0 &&
          counts.errors >= options.maxErrors
        ) {
          resolve({
            valid: false,
            errors: errors,
          })
          parser.end()
        }
      }
    }

    parser.onEnd = () => {
      // If no charges present, use the full schema to throw error for missing
      if (
        !validator.validate(
          hasCharges ? METADATA_SCHEMA : JSON_SCHEMA,
          metadata
        )
      ) {
        const validationErrors = (validator.errors as ErrorObject[]).map(
          enforce2025
            ? errorObjectToValidationError
            : errorObjectToValidationErrorWithWarnings
        )
        addErrorsToList(validationErrors, errors, options.maxErrors, counts)
        valid = counts.errors === 0
      }
      resolve({
        valid,
        errors,
      })
    }

    parser.onError = (e) => {
      parser.onEnd = () => null
      parser.onError = () => null
      parser.end()
      resolve({
        valid: false,
        errors: [
          {
            path: "",
            message: `JSON parsing error: ${e.message}. The validator is unable to review a syntactically invalid JSON file. Please ensure that your file is well-formatted JSON.`,
          },
        ],
      })
    }

    parseJson(jsonInput, parser)
  })
}

export const JsonValidatorTwoZero = {
  validateJson,
}

function errorObjectToValidationErrorWithWarnings(
  error: ErrorObject,
  index: number,
  errors: ErrorObject[]
): ValidationError {
  const validationError = errorObjectToValidationError(error)
  // If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm,
  // then a corresponding "Estimated Allowed Amount" must also be encoded. Required beginning 1/1/2025.
  // two validation errors occur for this conditional: one for the "required" keyword, one for the "if" keyword
  if (
    error.schemaPath ===
    "#/definitions/payers_information/allOf/1/then/required"
  ) {
    validationError.warning = true
  } else if (
    error.schemaPath === "#/definitions/payers_information/allOf/1/if" &&
    index > 0 &&
    errors[index - 1].schemaPath ===
      "#/definitions/payers_information/allOf/1/then/required"
  ) {
    validationError.warning = true
  }
  // If code type is NDC, then the corresponding drug unit of measure and drug type of measure data elements
  // must be encoded. Required beginning 1/1/2025.
  // two validation errors occur for this conditional: one for the "required" keyword, one for the "if" keyword
  else if (
    error.schemaPath === "#/then/required" &&
    error.params.missingProperty === "drug_information"
  ) {
    validationError.warning = true
  } else if (
    error.schemaPath === "#/if" &&
    index > 0 &&
    errors[index - 1].schemaPath === "#/then/required" &&
    errors[index - 1].params.missingProperty === "drug_information"
  ) {
    validationError.warning = true
  }
  // Any error involving the properties that are new for 2025 are warnings.
  // These properties are: drug_information, modifier_information, estimated_amount
  else if (
    error.instancePath.includes("/drug_information") ||
    error.instancePath.includes("/modifier_information") ||
    error.instancePath.includes("/estimated_amount")
  ) {
    validationError.warning = true
  }
  return validationError
}
