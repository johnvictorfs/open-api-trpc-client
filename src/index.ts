import {
  type AnyQueryProcedure,
  type AnyMutationProcedure,
  type AnyProcedure,
  type inferProcedureInput,
  type inferProcedureOutput,
  DefaultErrorShape,
  DefaultDataTransformer,
  RootConfig,
  CreateRouterInner,
  BuildProcedure,
  unsetMarker,
  ProcedureRouterRecord,
  AnyRouter,
} from '@trpc/server';
import { TRPCResponse } from '@trpc/server/rpc';
import { createRecursiveProxy } from '@trpc/server/shared';
import { type OpenAPIObject, type ParameterObject } from 'openapi3-ts/oas31';

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

type DecorateProcedure<TProcedure extends AnyProcedure> =
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

type FakePythonApiRouter = CreateRouterInner<FakeConfig, {
  users: CreateRouterInner<FakeConfig, {
    post: MutationProcedure<{ id: number, username: string, email: string, level: number }, { id: number, username: string, email: string, level: number, profile: { name: string, age: number } }>
    user_id: CreateRouterInner<FakeConfig, {
      get: QueryProcedure<{ user_id: number }, { id: number, username: string, email: string, level: number, profile: { name: string, age: number } }>
    }>
    profile: CreateRouterInner<FakeConfig, {
      user_id: CreateRouterInner<FakeConfig, {
        get: QueryProcedure<{ user_id: number }, { name: string, age: number }>
      }>
    }>,
  }>,
}>

export const createOpenApiClient = <TRouter extends AnyRouter>(
  baseUrl: string,
  schema: OpenAPIObject
) =>
  createRecursiveProxy(async (opts) => {
    const path = [...opts.path]; // e.g. ["post", "byId", "get", "query"]
    console.log(path)
    const trpcMethod = path.pop()! as 'query';
    const restMethod = path.pop()! as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';
    const slashPath = path.join('/'); // "post.byId" - this is the path procedures have on the backend
    let uri = `${baseUrl}/${slashPath}`;

    if (!schema.paths) {
      throw new Error('No paths in schema');
    }

    const queryParameters: { key: string, value: any }[] = []

    for (const [path, properties] of Object.entries(schema.paths)) {
      const pathWithoutBraces = path.replace(/{/g, '').replace(/}/g, '')

      if (pathWithoutBraces === `/${slashPath}`) {
        uri = `${baseUrl}${path}`;

        const allParameters: ParameterObject[] = Object.values(properties).flatMap((property) => {
          if ('parameters' in property) {
            return property.parameters
          } else {
            return []
          }
        })

        allParameters.forEach((parameter) => {
          if ('in' in parameter) {
            const argParameter = opts.args.find((arg) => {
              if (arg && typeof arg === 'object') {
                return Object.keys(arg).includes(parameter.name)
              }
            })

            const parameterValue = (argParameter && argParameter[parameter.name as keyof typeof argParameter]) as string

            if (parameter.in === 'path') {
              // url parameters (e.g. /users/{user_id} -> /users/1)
              uri = uri.replace(`{${parameter.name}}`, parameterValue.toString())
            } else if (parameter.in === 'query') {
              // query parameters (e.g. /users?user_id=1)
              queryParameters.push({ key: parameter.name, value: parameterValue })
            }
          }
        })
      }
    }

    queryParameters.forEach((queryParameter, index) => {
      if (index === 0) {
        uri += `?${queryParameter.key}=${queryParameter.value}`
      } else {
        uri += `&${queryParameter.key}=${queryParameter.value}`
      }
    })

    const [input] = opts.args;
    const stringifiedInput = input !== undefined && JSON.stringify(input);
    let body = restMethod === 'get' ? undefined : (stringifiedInput || undefined);
    console.log(`body`, body)

    const json = await fetch(uri, {
      method: restMethod,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).then((res) => res.json() as Promise<TRPCResponse>);

    if ('error' in json) {
      throw new Error(`Error: ${json.error.message}`);
    }

    return json;
  }) as DecoratedProcedureRecord<TRouter['_def']['record']>;

const getApiDocs = async () => {
  const response = await fetch('http://127.0.0.1:8000/schema/openapi.json')
  return await response.json() as OpenAPIObject
}

const testStuff = async () => {
  const schema = await getApiDocs()
  const litestarClient = createOpenApiClient<FakePythonApiRouter>('http://127.0.0.1:8000', schema);

  litestarClient.users.user_id.get.query({ user_id: 99 }).then((data) => {
    console.log(data.profile.age)
  })

  litestarClient.users.post.mutate({
    email: 'email@email.com',
    level: 2,
    id: 1,
    username: 'asd'
  }).then((data) => {
    console.log(data)
    console.log(`created ${JSON.stringify(data)}`)
  })
}

testStuff()
