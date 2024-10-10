import { ValidationError } from "../ValidationError";

export class CsvValidationError extends ValidationError {
  constructor(row: number, column: number, message: string) {
    super(csvCellName(row, column), message);
  }
}

export const ASCII_UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function csvCellName(row: number, column: number): string {
  return `${(column ?? -1) >= 0 ? csvColumnName(column) : "row "}${row + 1}`;
}

export function csvColumnName(column: number): string {
  let name = "";
  while (column >= 0) {
    name = ASCII_UPPERCASE[column % ASCII_UPPERCASE.length] + name;
    column = Math.floor(column / ASCII_UPPERCASE.length) - 1;
  }
  return name;
}
