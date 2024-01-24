import assert from 'assert';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { before, after, test } from 'node:test'

import { ZodType, z } from 'zod'
import { type SchemaObject, type OpenAPIObject, ReferenceObject } from 'openapi3-ts/oas31';

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

const isReferenceObject = (schema: SchemaObject | ReferenceObject): schema is ReferenceObject => {
  return '$ref' in schema
}

const getZodType = (schema: SchemaObject): ZodType => {
  switch (schema.type) {
    case 'boolean':
      return z.boolean()
    case 'array':
      // TODO: ReferenceObject
      return z.array(getZodType(schema.items as SchemaObject))
    case 'integer':
      return z.number()
    case 'number':
      return z.number()
    case 'string':
      return z.string()
    case 'object':
      return z.object(Object.entries(schema.properties as Record<string, SchemaObject>).reduce((acc, [key, value]) => {
        acc[key] = getZodType(value)
        return acc
      }))
      // TODO: Refs
      // return z.record(z.string(), getZodType(schema.properties as Record<string, SchemaObject>))
    default:
      return z.any()
  }
}

const parseZodSchemas = (schemas: Record<string, SchemaObject | ReferenceObject>) => {
  const zodSchemas: Record<string, ZodType> = {}
  const refs: string[] = []

  for (const [name, schema] of Object.entries(schemas)) {
    if (isReferenceObject(schema)) {
      // TODO: check if this makes sense
      const refName = schema.$ref.split('/').pop()

      if (!refName) {
        throw new Error(`Invalid ref: ${schema.$ref}`)
      }

      refs.push(refName)
    } else {
      zodSchemas[name] = getZodType(schema)
    }
  }

  // Fill in refs
  refs.forEach((refName) => {
    const refSchema = schemas[refName]

    if (!refSchema) {
      throw new Error(`Invalid ref: ${refName}`)
    }

    if (!isReferenceObject(refSchema)) {
      zodSchemas[refName] = getZodType(refSchema)
    } else {
      throw new Error(`Invalid ref: ${refName}`)
    }
  })

  return zodSchemas
}

const getApiDocs = async () => {
  const response = await fetch('http://127.0.0.1:8000/schema/openapi.json')
  return await response.json() as OpenAPIObject
}

test('can get api docs', async () => {
  const apiDocs = await getApiDocs()
  assert(apiDocs.info.title === 'Litestar API')
})

test('can get zodSchemas from OpenAPI schemas', async () => {
  const apiDocs = await getApiDocs()

  const schemas = apiDocs.components?.schemas

  if (!schemas) {
    throw new Error('No schemas')
  }

  const userDataTest = {
    username: 'test',
    email: 'test@email.com',
    level: 2,
    id: 1,
    profile: {
      age: 34,
      name: 'Test name',
    }
  }

  const userZodSchema = parseZodSchemas(schemas)['User']

  const result = userZodSchema.safeParse(userDataTest)

  assert(result.success)
})
