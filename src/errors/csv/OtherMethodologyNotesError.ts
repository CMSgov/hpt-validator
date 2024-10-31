import { CsvValidationError } from "./CsvValidationError";

export class OtherMethodologyNotesError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      'If the "standard charge methodology" encoded value is "other", there must be a corresponding explanation found in the "additional notes" for the associated payer-specific negotiated charge.'
    );
  }
}
