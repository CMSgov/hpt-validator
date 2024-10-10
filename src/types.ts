import { JsonTypes } from "@streamparser/json";
import { ValidationError } from "./errors/ValidationError";

export const SCHEMA_VERSIONS = [
  "v1.1",
  "v2.0",
  "v2.0.0",
  "v2.1.0",
  "v2.2.0",
] as const;
type SchemaVersionTuple = typeof SCHEMA_VERSIONS;
export type SchemaVersion = SchemaVersionTuple[number];

// export interface ValidationError {
//   path: string;
//   field?: string;
//   message: string;
//   warning?: boolean;
// }

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface CsvValidationError {
  row: number;
  column: number;
  field?: string;
  message: string;
  warning?: boolean;
}

/**
 * There will be a lot of duplication across different versions, this is intentional.
 * Maintenance will be easier to avoid conflicts across different versions if changes
 * can largely be isolated to a specific version, with commmon utilities in a shared
 * common module.
 */
export interface CsvValidatorVersion {
  validateHeader: (columns: string[], row: string[]) => CsvValidationError[];
  validateColumns: (columns: string[]) => CsvValidationError[];
  validateRow: (
    row: { [key: string]: string },
    index: number,
    columns: string[],
    wide: boolean
  ) => CsvValidationError[];
  isTall: (columns: string[]) => boolean;
}

export interface CsvValidationOptions {
  maxErrors?: number;
  onValueCallback?: (value: { [key: string]: string }) => void;
}

export interface JsonValidatorOptions {
  maxErrors?: number;
  onValueCallback?: (
    val: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct
  ) => void;
}

export interface JsonValidatorVersion {
  validate: (
    jsonInput: File | NodeJS.ReadableStream,
    options: JsonValidatorOptions
  ) => Promise<ValidationResult>;
}

export const STATE_CODES = [
  "AL",
  "AK",
  "AS",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "GU",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "MP",
  "OH",
  "OK",
  "OR",
  "PA",
  "PR",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VI",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;
type StateCodeTuple = typeof STATE_CODES;
export type StateCode = StateCodeTuple[number];
