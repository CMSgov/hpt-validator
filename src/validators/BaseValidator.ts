import { ValidationResult } from "../types"

export abstract class BaseValidator {
  abstract validate(
    input: File | NodeJS.ReadableStream
  ): Promise<ValidationResult>

  constructor(public fileType: "csv" | "json") {}
}
