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

export class InvalidNonNegativeNumberError extends CsvValidationError {
  constructor(
    row: number,
    column: number,
    public columnName: string,
    public value: string
  ) {
    super(
      row,
      column,
      `"${columnName}" value "${value}" is not a positive number or zero. You must encode a positive or zero numeric value.`
    );
  }
}
