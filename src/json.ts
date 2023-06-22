import { JSONParser, JsonTypes } from "@streamparser/json"
import Ajv, { ErrorObject } from "ajv"
import addFormats from "ajv-formats"
import {
  ValidationResult,
  BILLING_CODE_TYPES,
  DRUG_UNITS,
  STATE_CODES,
  CHARGE_SETTINGS,
  CHARGE_BILLING_CLASSES,
  CONTRACTING_METHODS,
  ValidationError,
} from "./types.js"

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

const STANDARD_CHARGE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: STANDARD_CHARGE_DEFINITIONS,
  ...STANDARD_CHARGE_PROPERTIES,
}

const METADATA_DEFINITIONS = {
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

const METADATA_PROPERTIES = {
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

const METADATA_REQUIRED = ["hospital_name", "last_updated_on", "version"]

const METADATA_SCHEMA = {
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

/**
 *
 * @param jsonInput Browser File or ReadableStream to stream content from
 * @param onValueCallback Callback function to process streamed standard charge items
 * @returns Promise with validation result
 */
export async function validateJson(
  jsonInput: File | NodeJS.ReadableStream,
  onValueCallback?: (
    val: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct
  ) => void
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
        if (onValueCallback) {
          onValueCallback(value)
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
      }
      errors.push(
        ...(validator.errors as ErrorObject[]).map(errorObjectToValidationError)
      )
      resolve({ valid, errors })
    }

    parser.onError = (e) => reject(e)

    if (typeof window !== "undefined" && jsonInput instanceof File) {
      const fileSize = jsonInput.size
      const chunkSize = 64 * 1024
      let offset = 0

      while (offset < fileSize) {
        try {
          const chunk = await readFileChunk(jsonInput, offset, chunkSize)
          parser.write(chunk)
          offset += chunk.length
        } catch (error) {
          reject(error)
        }
      }
      parser.end()
    } else {
      const jsonStream = jsonInput as NodeJS.ReadableStream
      jsonStream.on("data", (data) => parser.write(data))
      jsonStream.on("end", () => parser.end())
      jsonStream.on("error", (e) => reject(e))
    }
  })
}

/**
 *
 * @param jsonString String containing JSON for validation
 * @returns validation result
 */
export function validateJsonSync(jsonString: string): ValidationResult {
  const validator = new Ajv({ allErrors: true })
  addFormats(validator)
  const valid = validator.validate(JSON_SCHEMA, JSON.parse(jsonString))

  return {
    valid,
    errors: valid
      ? []
      : (validator.errors as ErrorObject[]).map(errorObjectToValidationError),
  }
}

function readFileChunk(
  file: File,
  start: number,
  chunkSize: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result as string)
    }

    reader.onerror = (e) => {
      reader.abort()
      reject(e)
    }

    const blob = file.slice(start, start + chunkSize)
    reader.readAsText(blob)
  })
}

// TODO: Update this, specifically to customize the message
function errorObjectToValidationError(error: ErrorObject): ValidationError {
  return { path: error.instancePath, message: error.message as string }
}
