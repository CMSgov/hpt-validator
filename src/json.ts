import { ValidationResult, JsonValidationOptions } from "./types.js";
import { JsonValidator } from "./validators/JsonValidator.js";

/**
 *
 * @param jsonInput Browser File or ReadableStream to stream content from
 * @param onValueCallback Callback function to process streamed standard charge items
 * @returns Promise with validation result
 */
export async function validateJson(
  jsonInput: File | NodeJS.ReadableStream,
  version: string,
  options: JsonValidationOptions = {}
): Promise<ValidationResult> {
  const validator = new JsonValidator(version);
  return validator.validate(jsonInput, options);
}
