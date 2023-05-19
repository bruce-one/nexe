const { mkdtemp, copyFile } = require('fs/promises')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')
const cp = require('child_process')

async function runTests() {
  const tempdir = await mkdtemp(path.join(os.tmpdir(), 'nexe-integration-tests-'))
  const executable = path.join(tempdir, path.basename(process.argv[0]))
  await copyFile(process.argv[0], executable)
  process.on('beforeExit', () => rimraf.sync(tempdir))
  cp.spawn(executable,
    [
    path.join(tempdir, 'node_modules/mocha/bin/mocha.js'),
      path.join(tempdir, 'test/integration/tests.integration-spec.js')
    ],
    { stdio: ['inherit', 'inherit', 'inherit', 'ipc'], cwd: tempdir }
  ).on('exit', (code) => {
    process.exitCode = code
  })
}

runTests()
