import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { assert, beforeAll, afterAll, test } from 'vitest'

import type { ApiRouter } from "./generated/api-client";
import { createOpenApiClient } from "src/client";

type LiteStarError = {
  status_code: number
  detail: string
  extra?: {
    message: string
    key: string
    source: string
  }[]
}

const executeLiteStarApi = async (): Promise<ChildProcessWithoutNullStreams> => {
  const process = spawn('poetry', ['run', 'python', '-m', 'litestar', 'run', '--port', '8000'], {
    cwd: 'tests/python-litestar',
  })

  // Wait for API to start
  return await new Promise((resolve) => {
    process.stderr.on('data', (data) => {
      console.debug(data.toString())
      if (data.toString().includes('Uvicorn running')) {
        resolve(process)
      }
    })

    process.stdout.on('data', (data) => console.debug(data.toString()))
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
  const { data } = await litestarClient.users.profile[userId].get.query()
  assert(data?.age === 22)
})

test('type errors where expected', async () => {
  const litestarClient = createOpenApiClient<ApiRouter, LiteStarError>('http://127.0.0.1:8000')

  const { error, response } = await litestarClient.users.post.mutate({
    data: {
      // @ts-expect-error
      email: 123
    }
  })

  assert(error?.detail.includes('Validation failed'))
  assert(response.status === 400)
})

test('can pass query params', async () => {
  const litestarClient = createOpenApiClient<ApiRouter>('http://127.0.0.1:8000')
  const userType = 'admin'
  const { data } = await litestarClient.users.search[userType].submit.post.mutate({
    data: {
      name: 'foo',
      age: 12
    },
    query: {
      order: 'desc',
      sort_by: 'email'
    }
  })

  assert(data?.username === 'foo')
})
