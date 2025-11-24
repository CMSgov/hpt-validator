import { CsvValidationError } from "./CsvValidationError.js";

export class DrugInformationRequiredError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      "If code type is NDC, then the corresponding drug unit of measure and drug type of measure data element must be encoded."
    );
  }
}
