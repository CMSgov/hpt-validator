import { CsvValidationError } from "./CsvValidationError.js";

export class ChargeWithPayerPlanError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      "If a payer name and plan name are encoded, a payer-specific charge must also be encoded."
    );
  }
}
