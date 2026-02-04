import { CsvValidationError } from "../errors/csv/index.js";

export class EstimatedAmountAlert extends CsvValidationError {
  constructor(column: number, columnName: string) {
    super(
      2,
      column,
      `Column ${columnName} found in column headers. The 'estimated amount' is no longer a required data element as of January 1, 2026. It has been replaced by the 10th percentile, median, 90th percentile, and count of allowed amounts.`
    );
  }
}
