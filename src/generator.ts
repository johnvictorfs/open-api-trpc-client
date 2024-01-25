// TODO: Rewrite in Rust
import type { MediaTypeObject, OpenAPIObject, ReferenceObject, SchemaObject } from "openapi3-ts/oas31"
import { promises as fs } from 'fs'
import prettier from 'prettier'

export type GeneratorConfig = {
  /**
   * The path to the OpenAPI schema, can be a local file or a URL
   */
  path: string
  /**
   * The destination of the generated file with type definitions
   */
  destination: string
}

const getDocs = async (path: string) => {
  let schema: OpenAPIObject | null = null

  if (path.startsWith('http')) {
    const response = await fetch(path)
    schema = await response.json() as OpenAPIObject
  } else {
    const fileContents = await fs.readFile(path, 'utf-8')
    schema = JSON.parse(fileContents) as OpenAPIObject
  }

  if (!schema?.openapi) {
    throw new Error('Invalid OpenAPI Schema')
  }

  const parsedVersion = schema.openapi.split('.').map((v) => parseInt(v))

  if (parsedVersion[0] !== 3 || parsedVersion[1] !== 1) {
    throw new Error(`Only OpenAPI 3.1 is supported, received ${schema.openapi}`)
  }

  return schema
}

const FILE_HEADER = `// This file is auto-generated and will be overwritten. Do not manually make changes
import type {
  AnyQueryProcedure,
  AnyMutationProcedure,
  AnyProcedure,
  inferProcedureInput,
  inferProcedureOutput,
  DefaultErrorShape,
  DefaultDataTransformer,
  RootConfig,
  CreateRouterInner,
  BuildProcedure,
  unsetMarker,
  ProcedureRouterRecord,
  AnyRouter,
} from '@trpc/server';
import { type TRPCResponse } from '@trpc/server/rpc';

type ProcedureParams<TInput> = {
  _config: RootConfig<{
    ctx: object
    meta: object
    errorShape: DefaultErrorShape
    transformer: DefaultDataTransformer,
  }>
  _output_out: typeof unsetMarker
  _meta: unknown
  _ctx_out: unknown
  _input_in: TInput
  _input_out: unknown
  _output_in: unknown
}

type QueryProcedure<TInput, TOutput> = BuildProcedure<'query', ProcedureParams<TInput>, TOutput>
type MutationProcedure<TInput, TOutput> = BuildProcedure<'mutation', ProcedureParams<TInput>, TOutput>

export type FakeConfig = RootConfig<{
  ctx: object;
  meta: object;
  errorShape: DefaultErrorShape;
  transformer: DefaultDataTransformer;
}>

type Resolver<TProcedure extends AnyProcedure> = (
  input: inferProcedureInput<TProcedure>
) => Promise<inferProcedureOutput<TProcedure>>;

export type DecorateProcedure<TProcedure extends AnyProcedure> =
  TProcedure extends AnyQueryProcedure
  ? {
    query: Resolver<TProcedure>;
  }
  : TProcedure extends AnyMutationProcedure
  ? {
    mutate: Resolver<TProcedure>;
  }
  : never;

type DecoratedProcedureRecord<TProcedures extends ProcedureRouterRecord> = {
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
  ? DecoratedProcedureRecord<TProcedures[TKey]['_def']['record']>
  : TProcedures[TKey] extends AnyProcedure
  ? DecorateProcedure<TProcedures[TKey]>
  : never;
};
`

const getTypeOfObjectSchema = (
  schemaObject: SchemaObject | ReferenceObject | MediaTypeObject,
  apiSchema: OpenAPIObject,
): string => {
  if ('schema' in schemaObject && schemaObject.schema) {
    return getTypeOfObjectSchema(schemaObject.schema, apiSchema)
  }

  if ('type' in schemaObject) {
    if ('enum' in schemaObject && schemaObject.enum) {
      return schemaObject.enum.map((v) => {
        if (typeof v === 'string') {
          return `'${v}'`
        }

        return `${v}`
      }).join(' | ')
    }

    if (schemaObject.type === 'string') {
      return 'string'
    }

    if (schemaObject.type === 'integer' || schemaObject.type === 'number') {
      return 'number'
    }

    if (schemaObject.type === 'boolean') {
      return 'boolean'
    }

    if (schemaObject.type === 'null') {
      return 'null'
    }

    if (schemaObject.type === 'object') {
      if ('properties' in schemaObject && schemaObject.properties) {
        return `{ ${Object.entries(schemaObject.properties).map(([key, value]) => {
          const required = schemaObject.required?.includes(key) ? '' : '?'
          return `${key}${required}: ${getTypeOfObjectSchema(value, apiSchema)}`
        }).join(', ')} }`
      }
    }
  }

  if ('oneOf' in schemaObject && schemaObject.oneOf) {
    return schemaObject.oneOf.map((v) => getTypeOfObjectSchema(v, apiSchema)).join(' | ')
  }

  if ('$ref' in schemaObject) {
    const reference = schemaObject.$ref

    if (reference.startsWith('#/components/schemas/')) {
      const referenceName = reference.slice('#/components/schemas/'.length)

      return referenceName
    }
  }

  return 'unknown'
}

const getTypeDefinition = async (schema: OpenAPIObject) => {
  if (!schema.paths) {
    throw new Error('No paths found in OpenAPI schema')
  }

  const paths = Object.entries(schema.paths).sort(([a], [b]) => {
    const aParts = a.split('/').filter((p) => p !== '')
    const bParts = b.split('/').filter((p) => p !== '')

    if (aParts.length === bParts.length) {
      return 0
    }

    if (aParts.length > bParts.length) {
      return 1
    }

    return -1
  })

  let typeDefinition = `export type ApiRouter = CreateRouterInner<FakeConfig, {\n`

  // { 'User': '{ name: string, age: number }' }
  const referenceDefinitions: Record<string, string> = {}

  Object.entries(schema?.components?.schemas || {}).forEach(([key, value]) => {
    referenceDefinitions[key] = getTypeOfObjectSchema(value, schema)
  })

  // export type User = { name: string, age: number }
  const referenceDefinitionsTypes = Object.entries(referenceDefinitions).map(([key, value]) => {
    return `export type ${key} = ${value}`
  }).join('\n\n')

  paths.forEach(([path, methods], pathIndex) => {
    // Example: ['users', 'search', '{user_type}', 'submit']
    (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const).forEach((method) => {
      if (!methods[method]) return

      const separatedPath = path.split('/').filter((p) => p !== '')
      let pathTypeDefinition = ``

      separatedPath.forEach((innerPath, index) => {
        const isUrlParameter = innerPath.startsWith('{') && innerPath.endsWith('}')
        const attributeName = isUrlParameter ? `[${innerPath.slice(1, -1)}: string]` : innerPath

        let pathIdentifier = `${attributeName}: `

        if (pathIndex !== 0) {
          const previousPath = paths[pathIndex - 1][0].split('/')[1]
          if (previousPath === innerPath) {
            // If this is from the same root path, just add to it
            pathIdentifier = ' & '
          }
        }

        pathTypeDefinition += `${pathIdentifier} CreateRouterInner<FakeConfig, {\n`
      })

      const procedure = method === 'get' || method === 'head' || method === 'options' ? 'QueryProcedure' : 'MutationProcedure'

      let queryParams = ``

      methods[method]?.parameters?.forEach((parameter) => {
        if ('in' in parameter) {
          if (parameter.in === 'query') {
            if (!queryParams) {
              queryParams = `{`
            }

            const paramType = getTypeOfObjectSchema(parameter.schema ?? {}, schema)
            queryParams += `${parameter.name}${parameter.required ? '' : '?'}: ${paramType},\n`
          }
        }
      })

      if (queryParams) {
        queryParams += `}`
      }

      let bodyParams = ``

      const requestBody = methods[method]?.requestBody
      if (requestBody && 'content' in requestBody && 'application/json' in requestBody.content) {
        const objectSchema = requestBody.content['application/json']

        if (objectSchema) {
          bodyParams = getTypeOfObjectSchema(objectSchema, schema)
        }
      }

      let outputType = ''

      const responses = methods[method]?.responses
      if (responses) {
        Object.entries(responses).forEach(([statusCode, response]) => {
          if (statusCode.startsWith('2')) {
            if ('content' in response && 'application/json' in response.content) {
              const objectSchema = response.content['application/json']

              if (objectSchema) {
                if (outputType) {
                  outputType += ' | '
                }

                outputType += getTypeOfObjectSchema(objectSchema, schema)
              }
            }
          }
        })
      }

      if (!outputType) {
        outputType = 'unknown'
      }

      let inputType = ``

      if (bodyParams) {
        inputType += `data: ${bodyParams}, `
      }

      if (queryParams) {
        inputType += `query: ${queryParams}, `
      }

      if (inputType) {
        inputType = `{\n${inputType}\n}`
      }

      if (!inputType) {
        inputType = 'void'
      }

      pathTypeDefinition += `${method}: ${procedure}<${inputType}, ${outputType}>`

      separatedPath.forEach((_innerPath, index) => {
        pathTypeDefinition += `}${index === separatedPath.length - 1 ? '>' : '>,'}\n`
      })

      typeDefinition += `${pathTypeDefinition}`
    })
  })

  typeDefinition += `}>`

  return prettier.format(`${FILE_HEADER}\n${referenceDefinitionsTypes}\n${typeDefinition}\n`, {
    parser: 'typescript'
  })
}

let lastSchema: OpenAPIObject | null = null

export const generateTypes = async (config: GeneratorConfig) => {
  const schema = await getDocs(config.path)

  if (JSON.stringify(schema) === JSON.stringify(lastSchema)) {
    return
  }

  if (lastSchema === null) {
    lastSchema = schema
  }

  const typeDefinition = await getTypeDefinition(schema)

  await fs.writeFile(config.destination, typeDefinition)
}
