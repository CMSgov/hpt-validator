import { CsvValidationError } from "./CsvValidationError";

export class ItemRequiresChargeError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      'If an item or service is encoded, a corresponding valid value must be encoded for at least one of the following: "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount", "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".'
    );
  }
}
