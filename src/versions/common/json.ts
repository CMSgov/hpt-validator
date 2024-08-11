import { ErrorObject } from "ajv"
import { ValidationError } from "../../types.js"
import { JSONParser } from "@streamparser/json"

export async function parseJson(
  jsonInput: File | NodeJS.ReadableStream,
  parser: JSONParser
): Promise<void> {
  if (typeof window !== "undefined" && jsonInput instanceof File) {
    const stream = jsonInput.stream()
    const reader = stream.getReader()
    const textDecoder = new TextDecoder("utf-8")

    function readChunk() {
      return reader.read().then(({ done, value }) => {
        if (done) {
          parser.end()
          return
        }

        parser.write(textDecoder.decode(value))
        readChunk()
      })
    }

    readChunk()
  } else {
    let firstChunk = true
    const jsonStream = jsonInput as NodeJS.ReadableStream
    jsonStream.on("end", () => parser.end())
    jsonStream.on("error", (e) => {
      throw e
    })
    jsonStream.on("data", (data: string) => {
      // strip utf-8 BOM: see https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
      if (firstChunk) {
        const dataBuffer = Buffer.from(data)
        if (
          dataBuffer.length > 2 &&
          dataBuffer[0] === 0xef &&
          dataBuffer[1] === 0xbb &&
          dataBuffer[2] === 0xbf
        ) {
          data = data.trimStart()
        }
        firstChunk = false
      }
      parser.write(data)
    })
  }
}

export function errorObjectToValidationError(
  error: ErrorObject
): ValidationError {
  return {
    path: error.instancePath,
    field: error.instancePath.split("/").pop(),
    message: error.message as string,
  }
}
