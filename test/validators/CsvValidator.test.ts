import * as fs from "fs";
import * as path from "path";
import { CsvValidator } from "../../src/validators/CsvValidator.js";
import {
  HeaderBlankError,
  InvalidVersionError,
  MinRowsError,
  ProblemsInHeaderError,
} from "../../src/errors/csv/index.js";

describe("CsvValidator", () => {
  describe("constructor", () => {
    it("should create a CsvValidator instance with a version", () => {
      const validator = new CsvValidator("v2.0.0");
      expect(validator.version).toBe("v2.0.0");
      expect(validator.fileType).toBe("csv");
      expect(validator.maxErrors).toBe(0);
      expect(validator.dataCallback).toBeUndefined();
    });

    it("should create a CsvValidator instance with additional options", () => {
      const valueCallback = (value: { [key: string]: string }) => {
        value.changed = "true";
      };
      const options = {
        maxErrors: 50,
        onValueCallback: valueCallback,
      };
      const validator = new CsvValidator("v2.1.0", options);
      expect(validator.version).toBe("v2.1.0");
      expect(validator.fileType).toBe("csv");
      expect(validator.maxErrors).toBe(50);
      expect(validator.dataCallback).toBe(valueCallback);
    });
  });

  describe("#validate", () => {
    it("should return an error when attempting to validate against an invalid version", async () => {
      const validator = new CsvValidator("x.y.z");
      const input = fs.createReadStream(
        new URL(
          path.join("..", "fixtures", "sample-tall-valid.csv"),
          import.meta.url
        )
      );
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBeInstanceOf(InvalidVersionError);
    });

    it("should return an error when a header row is blank", async () => {
      const validator = new CsvValidator("v2.2.0");
      const input = fs.createReadStream(
        new URL(
          path.join("..", "fixtures", "sample-blank-header.csv"),
          import.meta.url
        )
      );
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBeInstanceOf(HeaderBlankError);
    });

    it("should return an error when there are no data rows", async () => {
      const validator = new CsvValidator("v2.2.0");
      const input = fs.createReadStream(
        new URL(
          path.join("..", "fixtures", "sample-no-data.csv"),
          import.meta.url
        )
      );
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBeInstanceOf(MinRowsError);
    });

    it("should stop validation when there are problems in the header", async () => {
      const validator = new CsvValidator("v2.2.0");
      const input = fs.createReadStream(
        new URL(
          path.join("..", "fixtures", "sample-bad-header.csv"),
          import.meta.url
        )
      );
      const results = await validator.validate(input);
      expect(results.valid).toBe(false);
      expect(results.errors).toHaveLength(2);
      expect(results.errors[1]).toBeInstanceOf(ProblemsInHeaderError);
    });
  });
});
