import { CsvValidationError } from "./CsvValidationError";

export class ModifierMissingInfoError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      "If a modifier is encoded without an item or service, then a description and one of the following is the minimum information required: additional_payer_notes, standard_charge | negotiated_dollar, standard_charge | negotiated_percentage, or standard_charge | negotiated_algorithm."
    );
  }
}
