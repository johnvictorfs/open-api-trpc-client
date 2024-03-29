import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { assert, beforeAll, afterAll, test } from 'vitest'

import type { ApiRouter, User } from "./generated/api-client";
import { createOpenApiClient } from "src/client";

import { inferRouterOutputs, inferRouterInputs } from '@trpc/server'

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

test('can use types from generated typings', async () => {
  const _correctUser: User = {
    email: 'test@email.com',
    id: 2,
    level: 123,
    username: 'test'
  }

  const _wrongUser: User = {
    // @ts-expect-error
    id: 'asd'
  }
})

test('can use tRPC type inference helpers in generated router', async () => {
  type TestInputType = inferRouterInputs<ApiRouter>['users']['post']
  const _testUser: TestInputType = {
    data: {
      email: 'test',
      username: 'test',
      level: 1,
      id: 0,
    }
  }

  const _wrongTestUser: TestInputType = {
    // @ts-expect-error
    data: {
      username: 'test',
      level: 1,
      id: 0,
    }
  }

  type TestOutputType = inferRouterOutputs<ApiRouter>['users']['post']['profile']

  const _testProfile: TestOutputType = {
    age: 123,
    name: 'asd'
  }

  const _wrongTestProfile: TestOutputType = {
    // @ts-expect-error
    age: 'asd',
    name: 'asd'
  }
})
