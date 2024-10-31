import { CsvValidationError } from "./CsvValidationError";

export class CodePairMissingError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      "If a standard charge is encoded, there must be a corresponding code and code type pairing. The code and code type pairing do not need to be in the first code and code type columns (i.e., code|1 and code|1|type)."
    );
  }
}
