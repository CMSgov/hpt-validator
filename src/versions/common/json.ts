import { ErrorObject } from "ajv"
import { ValidationError } from "../../types.js"
import { JSONParser } from "@streamparser/json"

export async function parseJson(
  jsonInput: File | NodeJS.ReadableStream,
  parser: JSONParser,
  reject: (e: unknown) => void
): Promise<void> {
  if (typeof window !== "undefined" && jsonInput instanceof File) {
    const fileSize = jsonInput.size
    const chunkSize = 64 * 1024
    let offset = 0

    while (offset < fileSize) {
      try {
        const chunk = await readFileChunk(jsonInput, offset, chunkSize)
        parser.write(chunk)
        offset += chunk.length
      } catch (error) {
        reject(error)
      }
    }
    parser.end()
  } else {
    const jsonStream = jsonInput as NodeJS.ReadableStream
    jsonStream.on("data", (data) => parser.write(data))
    jsonStream.on("end", () => parser.end())
    jsonStream.on("error", (e) => reject(e))
  }
}

export function readFileChunk(
  file: File,
  start: number,
  chunkSize: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result as string)
    }

    reader.onerror = (e) => {
      reader.abort()
      reject(e)
    }

    const blob = file.slice(start, start + chunkSize)
    reader.readAsText(blob)
  })
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
