import assert from 'assert';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { before, after, test } from 'node:test'

import { ApiRouter } from "generated/api-client";
import { createOpenApiClient } from "src/client";

const executeLiteStarApi = async (): Promise<ChildProcessWithoutNullStreams> => {
  const process = spawn('poetry', ['run', 'litestar', 'run', '--port', '8000'], {
    cwd: 'tests/python-litestar',
  })

  // Wait for API to start
  return await new Promise((resolve) => {
    process.stderr.on('data', (data) => {
      if (data.toString().includes('Uvicorn running')) {
        resolve(process)
      }
    })
  })
}

let apiProcess: ChildProcessWithoutNullStreams

before(async () => {
  apiProcess = await executeLiteStarApi()
})

after(() => {
  if (apiProcess) {
    apiProcess.kill()
  }
})

test('can call API with generated client', async () => {
  const litestarClient = createOpenApiClient<ApiRouter>('http://127.0.0.1:8000')
  const userId = '99'
  const data = await litestarClient.users.profile[userId].get.query()
  assert(data?.age === 22)
})
