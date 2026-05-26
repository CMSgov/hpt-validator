import { CsvValidationError } from "./CsvValidationError.js";

export class ProblemsInHeaderError extends CsvValidationError {
  constructor() {
    super(
      0,
      0,
      "Errors were found in the headers in row 3, so the remaining rows were not evaluated."
    );
  }
}
