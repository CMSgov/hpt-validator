import { CsvValidationError } from "./CsvValidationError";

export class ColumnMissingError extends CsvValidationError {
  constructor(public columnName: string) {
    super(
      2,
      -1,
      `Column ${columnName} is miscoded or missing from row 3. You must include this column and confirm that it is encoded as specified in the data dictionary.`
    );
  }
}
