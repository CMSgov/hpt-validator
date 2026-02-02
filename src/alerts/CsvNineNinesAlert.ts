import { CsvValidationError } from "../errors/csv/index.js";

export class CsvNineNinesAlert extends CsvValidationError {
  constructor(row: number, column: number, columnName: string) {
    super(row, column, `Nine 9s used for ${columnName}.`);
  }
}
