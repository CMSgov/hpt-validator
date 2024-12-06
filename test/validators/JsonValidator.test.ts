import { InvalidJsonError } from "../../src/errors/json/InvalidJsonError.js";
import { JsonValidator } from "../../src/validators/JsonValidator.js";
import { createFixtureStream } from "../testhelpers/createFixtureStream.js";

describe("JsonValidator", () => {
  describe("schema v2.0.0", () => {
    // this is the earliest version of the schema supported by the validator.
    let validator: JsonValidator;

    beforeAll(() => {
      validator = new JsonValidator("v2.0.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file that starts with a byte-order mark", async () => {
      const input = createFixtureStream("sample-valid-bom.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it("should validate an empty json file", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(8);
    });

    it("should validate a syntactically invalid JSON file", async () => {
      const input = createFixtureStream("sample-invalid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvalidJsonError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("schema v2.1.0", () => {
    // this version adds several conditional requirements:
    // 1. If the "standard charge methodology" encoded value is "other", there must be a corresponding
    // explanation found in the "additional notes" for the associated payer-specific negotiated charge.
    // 2. If an item or service is encoded, a corresponding valid value must be encoded for at least one
    // of the following: "Gross Charge", "Discounted Cash Price", "Payer-Specific Negotiated Charge: Dollar Amount",
    // "Payer-Specific Negotiated Charge: Percentage", "Payer-Specific Negotiated Charge: Algorithm".
    // 3. If there is a "payer specific negotiated charge" encoded as a dollar amount, there must be a corresponding
    // valid value encoded for the deidentified minimum and deidentified maximum negotiated charge data.
    let validator: JsonValidator;

    beforeAll(() => {
      validator = new JsonValidator("v2.1.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file that starts with a byte-order mark", async () => {
      const input = createFixtureStream("sample-valid-bom.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it("should validate an empty json file", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(8);
    });

    it("should validate a syntactically invalid JSON file", async () => {
      const input = createFixtureStream("sample-invalid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvalidJsonError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it.todo(
      "should validate a file where a methodology is given as 'other', but no additional notes are provided"
    );

    it.todo(
      "should validate a file where a standard charge object has none of the possible charges"
    );

    it.todo(
      "should validate a file where there is a payer-specific dollar amount, but minimum and maximum are missing"
    );
  });

  describe("schema v2.2.0", () => {
    // this version adds drug information and modifier information to the schema.
    // there are two new conditional checks:
    // 4. If a "payer specific negotiated charge" can only be expressed as a percentage or algorithm, then
    // a corresponding "Estimated Allowed Amount" must also be encoded.
    // 5. If code type is NDC, then the corresponding drug unit of measure and drug type of measure data elements must be encoded.
    let validator: JsonValidator;

    beforeAll(() => {
      validator = new JsonValidator("v2.2.0");
    });

    it("should validate a valid file", async () => {
      const input = createFixtureStream("sample-valid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file that starts with a byte-order mark", async () => {
      const input = createFixtureStream("sample-valid-bom.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it("should validate an empty json file", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(8);
    });

    it("should validate a syntactically invalid JSON file", async () => {
      const input = createFixtureStream("sample-invalid.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvalidJsonError);
    });

    it("should limit the number of errors returned when the maxErrors option is used", async () => {
      const input = createFixtureStream("sample-empty.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it.todo("should validate a file that uses drug information correctly");

    it.todo("should validate a file with incorrectly formed drug information");

    it.todo("should validate a file that uses modifier information correctly");

    it.todo(
      "should validate a file with incorrectly formed modifier information"
    );

    it.todo(
      "should validate a file where a charge is expressed as a percentage or algorithm, but no estimated allowed amount is provided"
    );

    it.todo("should validate a file with an NDC code but no drug information");
  });
});
