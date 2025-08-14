import { ValidationError } from "src/errors/ValidationError.js";
import { InvalidJsonError } from "../../src/errors/json/InvalidJsonError.js";
import { JsonValidator } from "../../src/validators/JsonValidator.js";
import { createFixtureStream } from "../testhelpers/createFixtureStream.js";

describe("JsonValidator", () => {
  describe("constructor", () => {
    it("should create a new instace with defined schemas and subschemas", () => {
      const validator = new JsonValidator("v2.2.0");
      expect(validator.fullSchema).toBeDefined();
      expect(validator.standardChargeSchema).toBeDefined();
      expect(validator.metadataSchema).toBeDefined();
    });

    it("should throw an error when given a version that has no available schema", () => {
      expect(() => {
        new JsonValidator("x.y.z");
      }).toThrow("Could not load JSON schema with version: x.y.z");
    });
  });

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
      // this file normally could produce 3 errors when not limited
      const input = createFixtureStream("sample-no-min-max.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should validate a file where a methodology is given as 'other', but no additional notes are provided", async () => {
      const input = createFixtureStream("sample-other-no-notes.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'additional_payer_notes'",
          path: "/standard_charge_information/0/standard_charges/0/payers_information/0",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/0/standard_charges/0/payers_information/0",
        })
      );
    });

    it("should validate a file where a standard charge object has none of the possible charges", async () => {
      const input = createFixtureStream("sample-no-charges.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      // this one's subschema has a lot of individual errors, so just check that the subschema failed
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must match a schema in anyOf",
          path: "/standard_charge_information/2/standard_charges/0",
        })
      );
    });

    it("should validate a file where there is a payer-specific dollar amount, but minimum and maximum are missing", async () => {
      const input = createFixtureStream("sample-no-min-max.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/1/standard_charges/0",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'minimum'",
          path: "/standard_charge_information/1/standard_charges/0",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'maximum'",
          path: "/standard_charge_information/1/standard_charges/0",
        })
      );
    });
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

    it("should limit the number of alerts returned when the maxErrors option is used", async () => {
      // this file would generate five alerts, but the option limits the output
      const input = createFixtureStream("sample-lots-of-alerts.json");
      const result = await validator.validate(input, { maxErrors: 2 });
      expect(result.valid).toBe(true);
      expect(result.alerts).toHaveLength(2);
    });

    it("should validate a file that uses drug information correctly", async () => {
      const input = createFixtureStream("sample-valid-drug-info.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file with incorrectly formed drug information", async () => {
      const input = createFixtureStream("sample-wrong-drug-info.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must be string",
          path: "/standard_charge_information/4/drug_information/unit",
        })
      );
    });

    it("should validate a file that uses modifier information correctly", async () => {
      const input = createFixtureStream("sample-valid-modifier.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a file with incorrectly formed modifier information", async () => {
      const input = createFixtureStream("sample-wrong-modifier.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must be string",
          path: "/modifier_information/0/code",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'plan_name'",
          path: "/modifier_information/0/modifier_payer_information/0",
        })
      );
    });

    it("should validate a file where a charge is expressed as a percentage or algorithm, but no estimated allowed amount is provided", async () => {
      const input = createFixtureStream("sample-missing-estimate.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/0/standard_charges/0/payers_information/3",
        })
      );
    });

    it("should validate a file with an NDC code but no drug information", async () => {
      const input = createFixtureStream("sample-ndc-no-drug-info.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: 'must match "then" schema',
          path: "/standard_charge_information/4",
        })
      );
      expect(result.errors).toContainEqual<ValidationError>(
        expect.objectContaining({
          message: "must have required property 'drug_information'",
          path: "/standard_charge_information/4",
        })
      );
    });

    it("should validate a file that uses nine 9s for an estimated amount", async () => {
      const input = createFixtureStream("sample-nine-nines.json");
      const result = await validator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toEqual(
        expect.objectContaining({
          message: "Nine 9s used for estimated amount.",
          path: "/standard_charge_information/0/standard_charges/0/payers_information/2/estimated_amount",
        })
      );
    });
  });
});
