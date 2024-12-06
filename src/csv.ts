import {
  ValidationResult,
  SchemaVersion,
  CsvValidationOptions,
} from "./types.js";
import { CsvValidator } from "./validators/CsvValidator.js";

/**
 *
 * @param input Browser File or ReadableStream for streaming file content
 * @param onValueCallback Callback function to process streamed CSV row object
 * @returns Promise that resolves with the result of validation
 */
export async function validateCsv(
  input: File | NodeJS.ReadableStream,
  version: SchemaVersion,
  options: CsvValidationOptions = {}
): Promise<ValidationResult> {
  // currently, the CsvValidator takes options in the constructor,
  // but the JsonValidator takes them when validating.
  // we should pick one way, and stick with it.
  const validator = new CsvValidator(version, options);
  return validator.validate(input);
}
