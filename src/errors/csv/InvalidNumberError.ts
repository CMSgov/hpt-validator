import { CsvValidationError } from "./CsvValidationError.js";

export class InvalidPositiveNumberError extends CsvValidationError {
  constructor(
    row: number,
    column: number,
    public columnName: string,
    public value: string
  ) {
    super(
      row,
      column,
      `"${columnName}" value "${value}" is not a positive number. You must encode a positive, non-zero, numeric value.`
    );
  }
}

export class InvalidCountNumberError extends CsvValidationError {
  constructor(
    row: number,
    column: number,
    public columnName: string,
    public value: string
  ) {
    super(
      row,
      column,
      `"${columnName}" value "${value}" is not a valid count of allowed amounts. You must encode 0, an integer 11 or greater, or "1 through 10".`
    );
  }
}
