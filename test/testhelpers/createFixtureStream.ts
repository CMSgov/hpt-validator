import * as fs from "fs";
import * as path from "path";

export function createFixtureStream(fixture: string) {
  return fs.createReadStream(path.join(__dirname, "..", "fixtures", fixture), {
    encoding: "utf-8",
    highWaterMark: 1024,
  });
}
