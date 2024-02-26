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
  CHARGE_BILLING_CLASSES,
  CHARGE_SETTINGS,
  DRUG_UNITS,
  STANDARD_CHARGE_METHODOLOGY,
} from "./types.js"
import { errorObjectToValidationError, parseJson } from "../common/json.js"

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
      billing_class: {
        enum: CHARGE_BILLING_CLASSES,
        type: "string",
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
      },
    ],
    if: {
      type: "object",
      properties: {
        payers_information: {
          type: "array",
          items: {
            type: "object",
            not: {
              required: ["standard_charge_dollar"],
            },
          },
        },
      },
    },
    else: {
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

    if: {
      properties: {
        methodology: {
          const: "other",
        },
      },
      required: ["methodology"],
    },
    then: {
      required: ["additional_payer_notes"],
    },
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
    paths: ["$.*", "$.standard_charge_information.*"],
    keepStack: false,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: { [key: string]: any } = {}
  let valid = true
  let hasCharges = false
  const errors: ValidationError[] = []

  return new Promise(async (resolve, reject) => {
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
          valid = false
          errors.push(
            ...(validator.errors as ErrorObject[])
              .map(errorObjectToValidationError)
              .map((error) => ({
                ...error,
                path: error.path.replace(/\/0\//gi, `/${key}/`),
              }))
          )
        }
        if (options.onValueCallback) {
          options.onValueCallback(value)
        }
        if (
          options.maxErrors &&
          options.maxErrors > 0 &&
          errors.length > options.maxErrors
        ) {
          resolve({
            valid: false,
            errors: errors.slice(0, options.maxErrors),
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
        valid = false
        errors.push(
          ...(validator.errors as ErrorObject[]).map(
            errorObjectToValidationError
          )
        )
      }
      resolve({
        valid,
        errors:
          options.maxErrors && options.maxErrors > 0
            ? errors.slice(0, options.maxErrors)
            : errors,
      })
    }

    parser.onError = (e) => reject(e)

    // TODO: Assuming this must be awaited?
    await parseJson(jsonInput, parser, reject)
  })
}

export const JsonValidatorTwoZero = {
  validateJson,
}
