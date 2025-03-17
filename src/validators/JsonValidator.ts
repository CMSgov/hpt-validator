import fs from "fs";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { JSONParser } from "@streamparser/json";
import _ from "lodash";
const { bind } = _;
import { JsonValidationOptions, ValidationResult } from "../types.js";
import { BaseValidator } from "./BaseValidator.js";
import {
  addItemsWithLimit,
  errorObjectToValidationError,
  removeBOM,
} from "../utils.js";
import { ValidationError } from "../errors/ValidationError.js";
import { InvalidJsonError } from "../errors/json/InvalidJsonError.js";

export class JsonValidator extends BaseValidator {
  public fullSchema: any;
  public standardChargeSchema: any;
  public metadataSchema: any;
  public errors: ValidationError[] = [];
  public dataCallback?: JsonValidationOptions["onValueCallback"];
  public metadataCallback?: JsonValidationOptions["onMetadataCallback"];

  constructor(public version: string) {
    super("json");
    try {
      this.fullSchema = JSON.parse(
        fs.readFileSync(
          new URL(
            path.join("..", "schemas", `${version}.json`),
            import.meta.url
          ),
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
    options: JsonValidationOptions = {}
  ): Promise<ValidationResult> {
    this.errors = [];
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
    if (options.onValueCallback) {
      this.dataCallback = options.onValueCallback;
      bind(this.dataCallback, this);
    }
    if (options.onMetadataCallback) {
      this.metadataCallback = options.onMetadataCallback;
      bind(this.metadataCallback, this);
    }

    return new Promise(async (resolve) => {
      const errors = this.errors;
      parser.onValue = ({ value, key, stack }) => {
        if (stack.length > 2 || key === "standard_charge_information") return;
        if (typeof key === "string") {
          metadata[key] = value;
        } else {
          hasCharges = true;
          const pathPrefix = stack
            .filter((se) => se.key)
            .map((se) => se.key)
            .join("/");
          let newErrors: ValidationError[] = [];
          if (!validator.validate(this.standardChargeSchema, value)) {
            newErrors =
              validator.errors?.map(errorObjectToValidationError) ?? [];
            newErrors.forEach((error) => {
              error.path = `/${pathPrefix}/${key}${error.path}`;
            });
            addItemsWithLimit(newErrors, errors, options.maxErrors);
            valid = errors.length === 0;
          }
          if (this.dataCallback && value != null) {
            this.dataCallback(value, pathPrefix, key as number, newErrors);
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
        let metadataErrors: ValidationError[] = [];
        if (
          !validator.validate(
            hasCharges ? this.metadataSchema : this.fullSchema,
            metadata
          )
        ) {
          metadataErrors =
            validator.errors?.map(errorObjectToValidationError) ?? [];
          addItemsWithLimit(metadataErrors, errors, options.maxErrors);
          valid = errors.length === 0;
        }
        if (this.metadataCallback && metadata != null) {
          this.metadataCallback(metadata, metadataErrors);
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
