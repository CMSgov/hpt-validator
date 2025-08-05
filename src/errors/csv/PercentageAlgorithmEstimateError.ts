import { CsvValidationError } from "./CsvValidationError.js";

export class PercentageAlgorithmConditionalError extends CsvValidationError {
  constructor(row: number, column: number, conditionalField: string) {
    super(
      row,
      column,
      `If a "payer specific negotiated charge" is expressed as a percentage or algorithm, and count of allowed amounts is not zero, then a corresponding "${conditionalField}" must also be encoded.`
    );
  }
}

export class PercentageAlgorithmEstimateError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      `If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then a corresponding "Estimated Allowed Amount" must also be encoded.`
    );
  }
}

export class PercentageAlgorithmCountError extends CsvValidationError {
  constructor(row: number, column: number) {
    super(
      row,
      column,
      `If a "payer specific negotiated charge" is expressed as a percentage or algorithm, then a corresponding "Count of Allowed Amounts" must also be encoded.`
    );
  }
}

export class PercentageAlgorithmMedianError extends PercentageAlgorithmConditionalError {
  constructor(row: number, column: number) {
    super(row, column, "Median Amount");
  }
}

export class PercentageAlgorithm10thError extends PercentageAlgorithmConditionalError {
  constructor(row: number, column: number) {
    super(row, column, "10th Percentile");
  }
}

export class PercentageAlgorithm90thError extends PercentageAlgorithmConditionalError {
  constructor(row: number, column: number) {
    super(row, column, "90th Percentile");
  }
}
