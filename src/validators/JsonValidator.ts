import fs from "fs";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { JSONParser } from "@streamparser/json";
import { JsonValidatorOptions, ValidationResult } from "../types";
import { BaseValidator } from "./BaseValidator";
import {
  addItemsWithLimit,
  errorObjectToValidationError,
  removeBOM,
} from "../utils";
import { ValidationError } from "../errors/ValidationError";
import { InvalidJsonError } from "../errors/json/InvalidJsonError";

export class JsonValidator extends BaseValidator {
  private fullSchema: any;
  private standardChargeSchema: any;
  private metadataSchema: any;

  constructor(public version: string) {
    super("json");
    try {
      this.fullSchema = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "..", "schemas", `${version}.json`),
          "utf-8"
        )
      );
      this.buildStandardChargeSchema();
      this.buildMetadataSchema();
    } catch (err) {
      console.log(err);
      throw Error(`Could not load JSON schema with version: ${version}`);
    }
  }

  buildStandardChargeSchema() {
    this.standardChargeSchema = {
      $schema: this.fullSchema["$schema"],
      definitions: this.fullSchema.definitions,
      ...this.fullSchema.definitions.standard_charge_information,
    };
  }

  buildMetadataSchema() {
    this.metadataSchema = { ...this.fullSchema };
    delete this.metadataSchema.properties.standard_charge_information;
    this.metadataSchema.required = this.metadataSchema.required.filter(
      (propertyName: string) => propertyName !== "standard_charge_information"
    );
  }

  async validate(
    input: File | NodeJS.ReadableStream,
    options: JsonValidatorOptions = {}
  ): Promise<ValidationResult> {
    const validator = new Ajv({ allErrors: true });
    addFormats(validator);
    const parser = new JSONParser({
      paths: [
        "$.hospital_name",
        "$.last_updated_on",
        "$.license_information",
        "$.version",
        "$.hospital_address",
        "$.hospital_location",
        "$.affirmation",
        "$.modifier_information",
        "$.standard_charge_information.*",
      ],
      keepStack: false,
    });
    const metadata: { [key: string]: any } = {};
    let valid = true;
    let hasCharges = false;

    return new Promise(async (resolve) => {
      const errors: ValidationError[] = [];
      parser.onValue = ({ value, key, stack }) => {
        if (stack.length > 2 || key === "standard_charge_information") return;
        if (typeof key === "string") {
          metadata[key] = value;
        } else {
          hasCharges = true;
          if (!validator.validate(this.standardChargeSchema, value)) {
            const pathPrefix = stack
              .filter((se) => se.key)
              .map((se) => se.key)
              .join("/");
            const newErrors =
              validator.errors?.map(errorObjectToValidationError) ?? [];
            newErrors.forEach((error) => {
              error.path = `/${pathPrefix}/${key}${error.path}`;
            });
            addItemsWithLimit(newErrors, errors, options.maxErrors);
            valid = errors.length === 0;
          }
          if (options.onValueCallback && value != null) {
            options.onValueCallback(value);
          }
          if (
            options.maxErrors &&
            options.maxErrors > 0 &&
            errors.length >= options.maxErrors
          ) {
            resolve({
              valid: false,
              errors: errors,
            });
            parser.end();
          }
        }
      };

      parser.onEnd = () => {
        // If no charges present, use the full schema to throw error for missing
        if (
          !validator.validate(
            hasCharges ? this.metadataSchema : this.fullSchema,
            metadata
          )
        ) {
          const newErrors =
            validator.errors?.map(errorObjectToValidationError) ?? [];
          addItemsWithLimit(newErrors, errors, options.maxErrors);
          valid = errors.length === 0;
        }
        resolve({
          valid,
          errors,
        });
      };

      parser.onError = (e) => {
        parser.onEnd = () => null;
        parser.onError = () => null;
        parser.end();
        resolve({
          valid: false,
          errors: [new InvalidJsonError(e)],
        });
      };

      parseJson(input, parser);
    });
  }
}

export async function parseJson(
  jsonInput: File | NodeJS.ReadableStream,
  parser: JSONParser
): Promise<void> {
  if (typeof window !== "undefined" && jsonInput instanceof File) {
    const stream = jsonInput.stream();
    const reader = stream.getReader();
    const textDecoder = new TextDecoder("utf-8");

    function readChunk() {
      return reader.read().then(({ done, value }) => {
        if (done) {
          parser.end();
          return;
        }

        parser.write(textDecoder.decode(value));
        readChunk();
      });
    }

    readChunk();
  } else {
    let firstChunk = true;
    const jsonStream = jsonInput as NodeJS.ReadableStream;
    jsonStream.on("end", () => parser.end());
    jsonStream.on("error", (e) => {
      throw e;
    });
    jsonStream.on("data", (data: string) => {
      // strip utf-8 BOM: see https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
      if (firstChunk) {
        data = removeBOM(data);
        firstChunk = false;
      }
      parser.write(data);
    });
  }
}
