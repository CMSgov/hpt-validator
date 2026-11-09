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
  newItems.forEach((newItem) => {
    mainList.push(newItem);
  });
  return mainList.length;
}

export function errorObjectToValidationError(
  error: ErrorObject
): ValidationError {
  return new ValidationError(error.instancePath, error.message ?? "").withField(
    error.instancePath.split("/").pop() ?? ""
  );
}

export function errorObjectToValidationAlert(
  error: ErrorObject
): ValidationError {
  return new ValidationError(
    error.instancePath,
    (error.schema as any)?.["$message"] ?? error.message ?? ""
  ).withField(error.instancePath.split("/").pop() ?? "");
}

export function removeBOM(chunk: string | Buffer) {
  // strip utf-8 BOM: see https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
  if (typeof chunk == "string") {
    const dataBuffer = Buffer.from(chunk);
    if (
      dataBuffer.length > 2 &&
      dataBuffer[0] === 0xef &&
      dataBuffer[1] === 0xbb &&
      dataBuffer[2] === 0xbf
    ) {
      return chunk.trimStart();
    } else {
      return chunk;
    }
  } else if (
    chunk.length > 2 &&
    chunk[0] === 0xef &&
    chunk[1] === 0xbb &&
    chunk[2] === 0xbf
  ) {
    return chunk.subarray(3);
  } else {
    return chunk;
  }
}
