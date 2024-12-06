import { CsvValidationError } from "./CsvValidationError.js";

export class InvalidVersionError extends CsvValidationError {
  constructor() {
    super(0, 0, "Invalid version supplied");
  }
}
