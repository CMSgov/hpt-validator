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
  CONTRACTING_METHODS,
} from "./types.js"
import { errorObjectToValidationError, parseJson } from "../common/json.js"

const STANDARD_CHARGE_DEFINITIONS = {
  billing_code_information: {
    type: "object",
    properties: {
      code: { type: "string" },
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
      unit: { type: "string" },
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
      modifiers: {
        type: "array",
        items: { type: "string" },
        uniqueItems: true,
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
  },
  standard_charge_information: {
    type: "object",
    properties: {
      description: { type: "string" },
      drug_information: { $ref: "#/definitions/drug_information" },
      billing_code_information: {
        type: "array",
        items: { $ref: "#/definitions/billing_code_information" },
        minItems: 1,
      },
      standard_charges: {
        type: "array",
        items: { $ref: "#/definitions/standard_charges" },
        minItems: 1,
      },
    },
    required: ["description", "billing_code_information", "standard_charges"],
  },
  payers_information: {
    type: "object",
    properties: {
      payer_name: { type: "string" },
      plan_name: { type: "string" },
      additional_payer_notes: { type: "string" },
      standard_charge: { type: "number", exclusiveMinimum: 0 },
      standard_charge_percent: { type: "number", exclusiveMinimum: 0 },
      contracting_method: {
        enum: CONTRACTING_METHODS,
        type: "string",
      },
    },
    required: ["payer_name", "plan_name", "contracting_method"],
    if: {
      properties: {
        contracting_method: { const: "percent of total billed charges" },
      },
    },
    then: { required: ["standard_charge_percent"] },
    else: { required: ["standard_charge"] },
  },
}

const STANDARD_CHARGE_PROPERTIES = {
  type: "object",
  properties: {
    description: { type: "string" },
    drug_information: { $ref: "#/definitions/drug_information" },
    billing_code_information: {
      type: "array",
      items: { $ref: "#/definitions/billing_code_information" },
      minItems: 1,
    },
    standard_charges: {
      type: "array",
      items: { $ref: "#/definitions/standard_charges" },
      minItems: 1,
    },
  },
  required: ["description", "billing_code_information", "standard_charges"],
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
    required: ["license_number", "state"],
  },
}

export const METADATA_PROPERTIES = {
  hospital_name: { type: "string" },
  last_updated_on: { type: "string", format: "date" },
  license_information: {
    type: "array",
    items: { $ref: "#/definitions/license_information" },
    minItems: 1,
  },
  version: { type: "string" },
  hospital_location: { type: "string" },
  financial_aid_policy: { type: "string" },
}

export const METADATA_REQUIRED = ["hospital_name", "last_updated_on", "version"]

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

export const JsonValidatorOneOne = {
  validateJson,
}
