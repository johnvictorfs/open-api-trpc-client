// import type {
//   AnyQueryProcedure,
//   AnyMutationProcedure,
//   AnyProcedure,
//   inferProcedureInput,
//   inferProcedureOutput,
//   DefaultErrorShape,
//   DefaultDataTransformer,
//   RootConfig,
//   CreateRouterInner,
//   BuildProcedure,
//   unsetMarker,
//   ProcedureRouterRecord,
//   AnyRouter,
// } from '@trpc/server';
// import { type TRPCResponse } from '@trpc/server/rpc';
// import { AnyRouter } from '@trpc/server';
import { createRecursiveProxy } from '@trpc/server/shared';
import { type OpenAPIObject } from 'openapi3-ts/oas31';
import { ApiRouter, DecoratedProcedureRecord, ProcedureInputs } from './generated';
import { TRPCResponse } from '@trpc/server/rpc';
import { AnyRouter } from '@trpc/server';
// import { type ApiRouter } from './generated';

// type ProcedureParams<TInput> = {
//   _config: RootConfig<{
//     ctx: object
//     meta: object
//     errorShape: DefaultErrorShape
//     transformer: DefaultDataTransformer,
//   }>
//   _output_out: typeof unsetMarker
//   _meta: unknown
//   _ctx_out: unknown
//   _input_in: TInput
//   _input_out: unknown
//   _output_in: unknown
// }

// type QueryProcedure<TInput, TOutput> = BuildProcedure<'query', ProcedureParams<TInput>, TOutput>
// type MutationProcedure<TInput, TOutput> = BuildProcedure<'mutation', ProcedureParams<TInput>, TOutput>

// export type FakeConfig = RootConfig<{
//   ctx: object;
//   meta: object;
//   errorShape: DefaultErrorShape;
//   transformer: DefaultDataTransformer;
// }>

// type Resolver<TProcedure extends AnyProcedure> = (
//   input: inferProcedureInput<TProcedure>
// ) => Promise<inferProcedureOutput<TProcedure>>;

// type DecorateProcedure<TProcedure extends AnyProcedure> =
//   TProcedure extends AnyQueryProcedure
//   ? {
//     query: Resolver<TProcedure>;
//   }
//   : TProcedure extends AnyMutationProcedure
//   ? {
//     mutate: Resolver<TProcedure>;
//   }
//   : never;

// type DecoratedProcedureRecord<TProcedures extends ProcedureRouterRecord> = {
//   [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
//   ? DecoratedProcedureRecord<TProcedures[TKey]['_def']['record']>
//   : TProcedures[TKey] extends AnyProcedure
//   ? DecorateProcedure<TProcedures[TKey]>
//   : never;
// };

// export type ProcedureInputs<TData, TQueryParams> = {
//   data: TData,
//   query?: TQueryParams,
// }

// type FakePythonApiRouter = CreateRouterInner<FakeConfig, {
//   users: CreateRouterInner<FakeConfig, {
//     search: CreateRouterInner<FakeConfig, {
//       [key: string]: CreateRouterInner<FakeConfig, {
//         submit: CreateRouterInner<FakeConfig, {
//           post: MutationProcedure<ProcedureInputs<{ name: string, age: number }, { sort_by?: 'name' | 'email', order?: string }>, { id: number, username: string, email: string, level: number }>
//         }>
//       }>
//     }>,
//   }>,
//     // post: MutationProcedure<{ id: number, username: string, email: string, level: number }, { id: number, username: string, email: string, level: number, profile: { name: string, age: number } }>
//     // user_id: CreateRouterInner<FakeConfig, {
//     //   get: QueryProcedure<{ user_id: number }, { id: number, username: string, email: string, level: number, profile: { name: string, age: number } }>
//     // }>
//     // profile: CreateRouterInner<FakeConfig, {
//     //   user_id: CreateRouterInner<FakeConfig, {
//     //     get: QueryProcedure<{ user_id: number }, { name: string, age: number }>
//     //   }>
//     // }>,
// }>

export const createOpenApiClient = <TRouter extends AnyRouter>(
  baseUrl: string,
) =>
  createRecursiveProxy(async (opts) => {
    const path = [...opts.path]; // e.g. ["post", "byId", "get", "query"]
    console.log(path)
    const trpcMethod = path.pop()! as 'query';
    const restMethod = path.pop()! as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';
    const slashPath = path.join('/'); // "post.byId" - this is the path procedures have on the backend
    let uri = `${baseUrl}/${slashPath}`;

    const [input] = opts.args as [ProcedureInputs<any, any>]

    const queryParameters: { key: string, value: any }[] = input.query ? Object.entries(input.query).map(([key, value]) => ({ key, value })) : []

    console.log(`opts.args`, opts.args)

    console.log(`slashPath`, slashPath)
    console.log(`uri`, uri)

    queryParameters.forEach((queryParameter, index) => {
      if (index === 0) {
        uri += `?${queryParameter.key}=${queryParameter.value}`
      } else {
        uri += `&${queryParameter.key}=${queryParameter.value}`
      }
    })

    const stringifiedInput = input !== undefined && !!input?.data && JSON.stringify(input.data);
    let body = restMethod === 'get' ? undefined : (stringifiedInput || undefined);

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
  // const litestarClient = createOpenApiClient<FakePythonApiRouter>('http://127.0.0.1:8000');
  // litestarClient.users.search['admin'].submit.post.mutate({
  //   data: {

  //   }
  // })
  const litestarClient2 = createOpenApiClient<ApiRouter>('http://127.0.0.1:8000');
  // litestarClient2.users['asd'].get.query().then((d) => d.)
  /**
   * POST /users/search/admin/submit?sort_by=id&order=asc HTTP/1.1
   * 
   * {
   *   username: 'asd',
   *   email: 'asd@asd.com'
   * }
   */
  // const userType = 'admin'

  // litestarClient.users.search[userType].submit.post.mutate({
  //   query: {
  //     sort_by: 'email',
  //     order: 'asc',
  //   },
  //   data: {
  //     age: 12,
  //     name: 'asdasd'
  //   }
  // })
}

testStuff()
