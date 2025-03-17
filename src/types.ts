import { JsonTypes } from "@streamparser/json";
import { ValidationError } from "./errors/ValidationError.js";
import { CsvValidationError } from "./errors/csv/CsvValidationError.js";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface CsvValidationOptions {
  maxErrors?: number;
  onValueCallback?: (
    value: { [key: string]: string },
    errors: CsvValidationError[]
  ) => void;
}

export interface JsonValidationOptions {
  maxErrors?: number;
  onValueCallback?: (
    val: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct,
    pathPrefix: string,
    key: number,
    errors: ValidationError[]
  ) => void;
  onMetadataCallback?: (
    val: JsonTypes.JsonObject,
    errors: ValidationError[]
  ) => void;
}
