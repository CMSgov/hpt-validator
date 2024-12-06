import { CsvValidationError } from "./CsvValidationError.js";

export class InvalidDateError extends CsvValidationError {
  constructor(
    row: number,
    column: number,
    public columnName: string,
    public value: string
  ) {
    super(
      row,
      column,
      `"${columnName}" value "${value}" is not in a valid format. You must encode the date using the ISO 8601 format: YYYY-MM-DD or the month/day/year format: MM/DD/YYYY, M/D/YYYY`
    );
  }
}
