import test from "ava"
import { validateFilename } from "../src/filename.js"

test("validateFilename", (t) => {
  t.assert(!validateFilename(""))
  t.assert(validateFilename("121234567_Example-Hospital_standardcharges.csv"))
  t.assert(
    validateFilename(
      "12-1234567-1234567890_Example-Hospital_standardcharges.csv"
    )
  )
  t.assert(!validateFilename("1212345678_example_standardcharges.xlsx"))
  t.assert(
    validateFilename(
      "12-1234567-1234567890_Example Hospital_standardcharges.csv"
    )
  )
})
