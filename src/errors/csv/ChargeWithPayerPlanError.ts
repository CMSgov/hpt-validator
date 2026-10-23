import { CsvValidationError } from "./CsvValidationError.js";

export class ChargeWithPayerPlanError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      "If a payer name or plan name is encoded, a payer-specific charge must also be encoded."
    );
  }
}
