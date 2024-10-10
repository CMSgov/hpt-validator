import { CsvValidationError } from "./CsvValidationError";

export class DuplicateHeaderColumnError extends CsvValidationError {
  constructor(
    column: number,
    public columnName: string
  ) {
    super(
      0,
      column,
      `Column ${columnName} duplicated in header. You must review and revise your column headers so that each header appears only once in the first row.`
    );
  }
}
