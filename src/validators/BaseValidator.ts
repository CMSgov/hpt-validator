import { ValidationError } from "../errors/ValidationError.js";
import { ValidationResult } from "../types.js";

export abstract class BaseValidator {
  abstract validate(
    input: File | NodeJS.ReadableStream
  ): Promise<ValidationResult>;

  errors: ValidationError[] = [];
  alerts: ValidationError[] = [];

  constructor(public fileType: "csv" | "json") {}
}
