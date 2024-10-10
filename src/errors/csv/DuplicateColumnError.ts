import { CsvValidationError } from "./CsvValidationError";

export class DuplicateColumnError extends CsvValidationError {
  constructor(
    column: number,
    public columnName: string
  ) {
    super(
      2,
      column,
      `Column ${columnName} duplicated in header. You must review and revise your column headers so that each header appears only once in the third row.`
    );
  }
}
