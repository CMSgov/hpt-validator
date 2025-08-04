import { CsvValidationError } from "../errors/csv/index.js";

export class CsvNoPayerChargeAlert extends CsvValidationError {
  constructor(column: number) {
    super(-1, column, "File does not have any payer-specific charges");
  }
}
