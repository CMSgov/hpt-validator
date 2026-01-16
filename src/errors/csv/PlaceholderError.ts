import { CsvValidationError } from "./CsvValidationError.js";

export class PlaceholderError extends CsvValidationError {
  constructor(
    public columnName: string,
    public column: number
  ) {
    super(
      2,
      column,
      `Column header ${columnName} contains a placeholder. All placeholders must be removed from column headers.`
    );
  }
}
