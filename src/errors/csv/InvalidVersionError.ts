import { CsvValidationError } from "./CsvValidationError.js";

export class InvalidVersionError extends CsvValidationError {
  constructor(public versions: string[]) {
    super(
      0,
      0,
      `Invalid version supplied. Allowed versions are: ${versions.join(", ")}`
    );
  }
}
