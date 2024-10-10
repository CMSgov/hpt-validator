import { CsvValidationError } from "./CsvValidationError";

export class ProblemsInHeaderError extends CsvValidationError {
  constructor() {
    super(
      0,
      0,
      "Errors were found in the headers or values in rows 1 through 3, so the remaining rows were not evaluated."
    );
  }
}
