import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { assert, beforeAll, afterAll, test } from 'vitest'

import type { ApiRouter } from "./generated/api-client";
import { createOpenApiClient } from "src/client";

const executeLiteStarApi = async (): Promise<ChildProcessWithoutNullStreams> => {
  const process = spawn('poetry', ['run', 'python', '-m', 'litestar', 'run', '--port', '8000'], {
    cwd: 'tests/python-litestar',
  })

  // Wait for API to start
  return await new Promise((resolve) => {
    process.stderr.on('data', (data) => {
      console.log(data.toString())
      if (data.toString().includes('Uvicorn running')) {
        resolve(process)
      }
    })
  })
}

let apiProcess: ChildProcessWithoutNullStreams

beforeAll(async () => {
  apiProcess = await executeLiteStarApi()
})

afterAll(() => {
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
