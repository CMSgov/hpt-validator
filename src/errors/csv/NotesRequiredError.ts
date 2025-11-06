import { CsvValidationError } from "./CsvValidationError.js";

export class NotesRequiredError extends CsvValidationError {
  constructor(row: number, column: number, element: string, value: string) {
    super(
      row,
      column,
      `If the "${element}" encoded value is "${value}", there must be a corresponding explanation found in the "additional notes" for the associated payer-specific negotiated charge.`
    );
  }
}

export class OtherMethodologyNotesError extends NotesRequiredError {
  constructor(row: number, column: number) {
    super(row, column, "standard charge methodology", "other");
  }
}

export class AllowedCountZeroNotesError extends NotesRequiredError {
  constructor(row: number, column: number) {
    super(row, column, "count of allowed amounts", "0");
  }
}
