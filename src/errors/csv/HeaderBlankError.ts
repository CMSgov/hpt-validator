import { CsvValidationError } from "./CsvValidationError.js";

export class HeaderBlankError extends CsvValidationError {
  constructor(row: number) {
    super(
      row,
      0,
      `Required headers must be defined on rows 1 and 3. Row ${row + 1} is blank`
    );
  }
}
