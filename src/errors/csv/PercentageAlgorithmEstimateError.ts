import { CsvValidationError } from "./CsvValidationError";

export class PercentageAlgorithmEstimateError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      'If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.'
    );
  }
}
