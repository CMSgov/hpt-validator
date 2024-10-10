import { CsvValidationError } from "./CsvValidationError";

export class MinRowsError extends CsvValidationError {
  constructor() {
    super(0, 0, "At least one row must be present");
  }
}
