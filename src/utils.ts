import { ErrorObject } from "ajv";
import { ValidationError } from "./errors/ValidationError.js";

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
