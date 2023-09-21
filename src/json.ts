import {
  ValidationResult,
  SchemaVersion,
  JsonValidatorOptions,
} from "./types.js"
import { JsonValidatorOneOne } from "./versions/1.1/json.js"

/**
 *
 * @param jsonInput Browser File or ReadableStream to stream content from
 * @param onValueCallback Callback function to process streamed standard charge items
 * @returns Promise with validation result
 */
export async function validateJson(
  jsonInput: File | NodeJS.ReadableStream,
  version: SchemaVersion,
  options: JsonValidatorOptions = {}
): Promise<ValidationResult> {
  if (version === "v1.1") {
    return JsonValidatorOneOne.validateJson(jsonInput, options)
  }
  return new Promise((resolve) => {
    resolve({
      valid: false,
      errors: [{ path: "/", message: `Invalid version "${version}" supplied` }],
    })
  })
}
