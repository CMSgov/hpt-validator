import { CsvValidationError } from "../errors/csv/index.js";

// the function gets passed the data row and row index
// but there can be things before that, which get bound in when assembling the validation tree

export type DynaReadyValidator = (
  dataRow: { [key: string]: string },
  row: number
) => CsvValidationError[];

export type ToastyValidator = {
  name: string;
  predicate?: (row: { [key: string]: string }) => boolean;
  validator?: DynaReadyValidator;
  negativeValidator?: DynaReadyValidator;
  toastyChildren?: ToastyValidator[];
  negativeChildren?: ToastyValidator[];
};
