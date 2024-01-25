import { MediaTypeObject, OpenAPIObject, ReferenceObject, SchemaObject } from "openapi3-ts/oas31"

const getDocs = async (path: string) => {
  const response = await fetch(path)
  const schema = await response.json() as OpenAPIObject

  if (!schema?.openapi) {
    throw new Error('Invalid OpenAPI Schema')
  }

  const parsedVersion = schema.openapi.split('.').map((v) => parseInt(v))

  if (parsedVersion[0] !== 3 || parsedVersion[1] !== 1) {
    throw new Error(`Only OpenAPI 3.1 is supported, received ${schema.openapi}`)
  }

  return schema
}

const config = {
  path: 'http://127.0.0.1:8000/schema/openapi.json',
  destination: 'src/generated.d.ts',
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

      if (apiSchema.components?.schemas && referenceName in apiSchema.components?.schemas) {
        return getTypeOfObjectSchema(apiSchema.components?.schemas[referenceName], apiSchema)
      }
    }
  }

  return 'unknown'
}

const generate = async () => {
  const schema = await getDocs(config.path)

  if (!schema.paths) {
    throw new Error('No paths found in OpenAPI schema')
  }

  const paths = Object.entries(schema.paths)

  let typeDefinition = `export type ApiRouter = CreateRouterInner<FakeConfig, {\n`

  paths.forEach(([path, methods]) => {
    // Example: ['users', 'search', '{user_type}', 'submit']
    (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const).forEach((method) => {
      if (!methods[method]) return

      const separatedPath = path.split('/').filter((p) => p !== '')
      let pathTypeDefinition = ``

      separatedPath.forEach((innerPath, index) => {
        const isUrlParameter = innerPath.startsWith('{') && innerPath.endsWith('}')
        const attributeName = isUrlParameter ? `[${innerPath.slice(1, -1)}: string]` : innerPath

        pathTypeDefinition += `${' '.repeat((index + 1) * 2)}${attributeName}: CreateRouterInner<FakeConfig, {\n`
      })

      const procedure = method === 'get' || method === 'head' || method === 'options' ? 'QueryProcedure' : 'MutationProcedure'

      let bodyParams = ``
      let queryParams = ``

      methods[method]?.parameters?.forEach((parameter) => {
        if ('in' in parameter) {
          if (parameter.in === 'query') {
            if (!queryParams) {
              queryParams = `{`
            }

            queryParams += `${parameter.name}${parameter.required ? '' : '?'}: ${getTypeOfObjectSchema(parameter.schema ?? {}, schema)},\n`
            // queryParams += `${parameter.name}?: ${parameter.schema ?? 'unknown'}\n`
          }
        }
      })

      if (queryParams) {
        queryParams += `}`
      }

      const requestBody = methods[method]?.requestBody
      if (requestBody && 'content' in requestBody && 'application/json' in requestBody.content) {
        const objectSchema = requestBody.content['application/json']

        if (objectSchema) {
          bodyParams = getTypeOfObjectSchema(objectSchema, schema)
        }
      }

      let outputType = `` // TODO: get output type

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

      // ProcedureInputs<${bodyParams}, ${queryParams}>

      pathTypeDefinition += `${' '.repeat(separatedPath.length * 2)}${method}: ${procedure}<${inputType}, ${outputType}>`

      separatedPath.forEach((_innerPath, index) => {
        pathTypeDefinition += `${' '.repeat(index * 2)}}${index === separatedPath.length - 1 ? '>' : '>,'}\n`
      })

      typeDefinition += `${pathTypeDefinition}`
    })
  })

  typeDefinition += `}>`

  return `${FILE_HEADER}
${typeDefinition}\n`
}

import { promises as fs } from 'fs'

const main = async () => {
  const typeDefinition = await generate()

  await fs.writeFile(config.destination, typeDefinition)
}

main()