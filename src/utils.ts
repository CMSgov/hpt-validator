import { ErrorObject } from "ajv";
import { ValidationError } from "./errors/ValidationError.js";

export function oldAddErrorsToList<T extends { warning?: boolean | undefined }>(
  newErrors: T[],
  errorList: T[],
  maxErrors = 0,
  counts: { errors: number; warnings: number }
) {
  // if warning list is already full, don't add the new warnings
  if (maxErrors > 0 && counts.warnings >= maxErrors) {
    newErrors = newErrors.filter((error) => error.warning !== true);
    // only add enough to reach the limit
    if (counts.errors + newErrors.length > maxErrors) {
      newErrors = newErrors.slice(0, maxErrors - counts.errors);
    }
    errorList.push(...newErrors);
    counts.errors += newErrors.length;
  } else {
    newErrors.forEach((error) => {
      if (error.warning) {
        if (maxErrors <= 0 || counts.warnings < maxErrors) {
          errorList.push(error);
          counts.warnings++;
        }
      } else {
        if (maxErrors <= 0 || counts.errors < maxErrors) {
          errorList.push(error);
          counts.errors++;
        }
      }
    });
  }

  return counts;
}

export function addItemsWithLimit<T>(
  newItems: T[],
  mainList: T[],
  maxItems = 0
) {
  if (maxItems > 0 && mainList.length + newItems.length > maxItems) {
    newItems = newItems.slice(0, maxItems - mainList.length);
  }
  mainList.push(...newItems);
  return mainList.length;
}

export function errorObjectToValidationError(
  error: ErrorObject
): ValidationError {
  return new ValidationError(error.instancePath, error.message ?? "").withField(
    error.instancePath.split("/").pop() ?? ""
  );
}

export function removeBOM(chunk: string): string {
  // strip utf-8 BOM: see https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
  const dataBuffer = Buffer.from(chunk);
  if (
    dataBuffer.length > 2 &&
    dataBuffer[0] === 0xef &&
    dataBuffer[1] === 0xbb &&
    dataBuffer[2] === 0xbf
  ) {
    chunk = chunk.trimStart();
  }
  return chunk;
}
