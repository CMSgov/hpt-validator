import { JsonTypes } from "@streamparser/json";
import { ValidationError } from "./errors/ValidationError.js";
import { CsvValidationError } from "./errors/csv/CsvValidationError.js";

export interface ValidationAlert {
  path: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  alerts: ValidationError[];
}

export interface CsvValidationOptions {
  maxErrors?: number;
  onValueCallback?: (
    value: { [key: string]: string },
    errors: CsvValidationError[],
    alerts: CsvValidationError[]
  ) => void;
}

export interface JsonValidationOptions {
  maxErrors?: number;
  onValueCallback?: (
    val: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct,
    pathPrefix: string,
    key: number,
    errors: ValidationError[],
    alerts: ValidationError[]
  ) => void;
  onMetadataCallback?: (
    val: JsonTypes.JsonObject,
    errors: ValidationError[],
    alerts: ValidationError[]
  ) => void;
}
