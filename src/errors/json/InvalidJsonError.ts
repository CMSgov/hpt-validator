import { ValidationError } from "../ValidationError.js";

export class InvalidJsonError extends ValidationError {
  constructor(public originalError: Error) {
    super(
      "",
      `JSON parsing error: ${originalError.message}. The validator is unable to review a syntactically invalid JSON file. Please ensure that your file is well-formatted JSON.`
    );
  }
}
