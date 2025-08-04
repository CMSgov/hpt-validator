import { ValidationError } from "../errors/ValidationError.js";

export class JsonNoPayerChargeAlert extends ValidationError {
  constructor() {
    super(
      "/standard_charge_information",
      "File does not have any payer-specific charges."
    );
  }
}
