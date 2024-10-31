import { CsvValidationError } from "./CsvValidationError";

export class DollarNeedsMinMaxError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      'If there is a "payer specific negotiated charge" encoded as a dollar amount, there must be a corresponding valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.'
    );
  }
}
