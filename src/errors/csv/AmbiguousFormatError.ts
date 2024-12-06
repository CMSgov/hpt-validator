import { CsvValidationError } from "./CsvValidationError.js";

export class AmbiguousFormatError extends CsvValidationError {
  constructor() {
    super(
      2,
      -1,
      'Required payer-specific information data element headers are missing or miscoded from the MRF that does not follow the specifications for the CSV "Tall" or CSV "Wide" format.'
    );
  }
}
