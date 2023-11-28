import * as fs from "fs"
import * as path from "path"
import * as url from "url"
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

export function loadFixtureStream(
  version: string,
  name: string
): fs.ReadStream {
  return fs.createReadStream(path.join(__dirname, "fixtures", version, name), {
    encoding: "utf-8",
    highWaterMark: 1024,
  })
}
