import { ValidationError } from "../errors/ValidationError.js";
import { CsvValidationError } from "../errors/csv/index.js";

export class CsvFalseAffirmationAlert extends CsvValidationError {
  constructor(column: number) {
    super(2, column, "Affirmation value is false.");
  }
}

export class JsonFalseAffirmationAlert extends ValidationError {
  constructor() {
    super("/affirmation/confirm_affirmation", "Affirmation value is false.");
  }
}

export class CsvFalseAttestationAlert extends CsvValidationError {
  constructor(column: number) {
    super(2, column, "Attestation value is false.");
  }
}

export class JsonFalseAttestationAlert extends ValidationError {
  constructor() {
    super("/attestation/confirm_attestation", "Attestation value is false.");
  }
}
