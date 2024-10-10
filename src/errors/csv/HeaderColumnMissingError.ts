import { CsvValidationError } from "./CsvValidationError";

export class HeaderColumnMissingError extends CsvValidationError {
  constructor(public columnName: string) {
    super(
      0,
      -1,
      `Header column "${columnName}" is miscoded or missing. You must include this header and confirm that it is encoded as specified in the data dictionary.`
    );
  }
}
