import { CsvValidationError } from "../errors/csv/index.ts";

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

export type CsvFileLevelValidator = {
  name: string;
  applicableVersion: string;
  state: { [key: string]: any };
  rowCheck: (
    dataRow: { [key: string]: string },
    state: CsvFileLevelValidator["state"]
  ) => void;
  fileCheck: (state: CsvFileLevelValidator["state"]) => CsvValidationError[];
};
