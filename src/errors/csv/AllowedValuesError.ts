import { CsvValidationError } from "./CsvValidationError.js";

export class AllowedValuesError extends CsvValidationError {
  constructor(
    row: number,
    column: number,
    public columnName: string,
    public value: string,
    public allowedValues: string[]
  ) {
    super(
      row,
      column,
      `"${columnName}" value "${value}" is not one of the allowed valid values. You must encode one of these valid values: ${allowedValues.join(
        ", "
      )}`
    );
  }
}
