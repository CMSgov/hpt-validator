import { CsvValidationError } from "../errors/csv/index.js";

export class CsvNineNinesAlert extends CsvValidationError {
  constructor(row: number, column: number) {
    super(row, column, "Nine 9s used for estimated amount.");
  }
}
