import { JsonTypes } from "@streamparser/json";
import { ValidationError } from "./errors/ValidationError.js";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface CsvValidationOptions {
  maxErrors?: number;
  onValueCallback?: (value: { [key: string]: string }) => void;
}

export interface JsonValidationOptions {
  maxErrors?: number;
  onValueCallback?: (
    val: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct
  ) => void;
}
