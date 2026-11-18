import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const routeModule = fileURLToPath(new URL("./page.tsx", import.meta.url))

function runStaticParams(directory: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `
    process.chdir(${JSON.stringify(directory)})
    const { generateStaticParams } = await import(${JSON.stringify(routeModule)})
    process.stdout.write(JSON.stringify(await generateStaticParams()))
  `], { encoding: "utf8" })
}

test("static generation fails when the post directory cannot be read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blog-static-params-"))

  try {
    await mkdir(join(directory, "src/content"), { recursive: true })
    await writeFile(join(directory, "src/content/posts"), "not a directory")
    const result = runStaticParams(directory)

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FileSystemError/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("static generation returns the published post slugs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blog-static-params-"))

  try {
    await mkdir(join(directory, "src/content/posts"), { recursive: true })
    await writeFile(join(directory, "src/content/posts/fixture.md"), "Fixture")
    const result = runStaticParams(directory)

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), [{ slug: "fixture" }])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
