import { CsvValidationError } from "./CsvValidationError.js";

export class RequiredValueError extends CsvValidationError {
  constructor(
    row: number,
    column: number,
    public columnName: string,
    suffix: string = ""
  ) {
    super(
      row,
      column,
      `A value is required for "${columnName}"${suffix}. You must encode the missing information.`
    );
  }
}
