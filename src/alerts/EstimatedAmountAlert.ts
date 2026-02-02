import { CsvValidationError } from "../errors/csv/index.js";

export class EstimatedAmountAlert extends CsvValidationError {
  constructor(column: number, columnName: string) {
    super(2, column, `Column ${columnName} found in column headers.`);
  }
}
