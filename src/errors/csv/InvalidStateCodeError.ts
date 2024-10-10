import { CsvValidationError } from "./CsvValidationError";

export class InvalidStateCodeError extends CsvValidationError {
  constructor(column: number, stateCode: string) {
    super(
      0,
      column,
      `${stateCode} is not an allowed value for state abbreviation. You must fill in the state or territory abbreviation even if there is no license number to encode. See the table found here for the list of valid values for state and territory abbreviations https://github.com/CMSgov/hospital-price-transparency/blob/master/documentation/CSV/state_codes.md`
    );
  }
}
