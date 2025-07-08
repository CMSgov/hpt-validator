import { CsvValidationError } from "../errors/csv/index.js";

// the function gets passed the data row and row index
// but there can be things before that, which get bound in when assembling the validation tree

export type DynaReadyValidator = (
  dataRow: { [key: string]: string },
  row: number
) => CsvValidationError[];

export type BranchingValidator = {
  name: string;
  applicableVersion: string;
  predicate?: (row: { [key: string]: string }) => boolean;
  validator?: DynaReadyValidator;
  negativeValidator?: DynaReadyValidator;
  children?: BranchingValidator[];
  negativeChildren?: BranchingValidator[];
};

export type OriginalFlavorValidator = {
  name: string;
  applicableVersion: string;
  predicate?: (row: { [key: string]: string }) => boolean;
  validator?: DynaReadyValidator;
};

// const descriptionRule = {
//   name: "description",

// }

// export function getAllThoseRules(
//   version: string,
//   normalizedColumns: string[],
//   dataColumns: string[]
// ): BranchingValidator[] {
//   return [];
// }
// ghfhhghf. there's like.
// run this function, it will return a list of errors
// then there are children but there are like. conditional children
// maybe it just has like. ugh. ugh!
