import { createRecursiveProxy } from '@trpc/server/shared';
import type { TRPCResponse } from '@trpc/server/rpc';
import type { AnyMutationProcedure, AnyProcedure, AnyQueryProcedure, AnyRouter, ProcedureRouterRecord, inferProcedureInput, inferProcedureOutput } from '@trpc/server';

type ProcedureOutput<TProcedure, TError = unknown> = {
  response: Response
} & ({
  data: inferProcedureOutput<TProcedure>
  error: null
} | {
  data: null
  error: TError
})

type Resolver<TProcedure extends AnyProcedure, TError = unknown> = (
  input: inferProcedureInput<TProcedure>
) => Promise<ProcedureOutput<TProcedure, TError>>;

type DecorateProcedure<TProcedure extends AnyProcedure, TError = unknown> =
  TProcedure extends AnyQueryProcedure
  ? {
    query: Resolver<TProcedure, TError>;
  }
  : TProcedure extends AnyMutationProcedure
  ? {
    mutate: Resolver<TProcedure, TError>;
  }
  : never;

type DecoratedProcedureRecord<TProcedures extends ProcedureRouterRecord, TError = unknown> = {
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
  ? DecoratedProcedureRecord<TProcedures[TKey]['_def']['record'], TError>
  : TProcedures[TKey] extends AnyProcedure
  ? DecorateProcedure<TProcedures[TKey], TError>
  : never;
};

export const createOpenApiClient = <TRouter extends AnyRouter, TError = unknown>(
  baseUrl: string,
) =>
  // https://trpc.io/blog/tinyrpc-client
  createRecursiveProxy(async (opts) => {
    const path = [...opts.path]; // e.g. ["post", "byId", "get", "query"]

    const trpcMethod = path.pop()! as 'query';
    const restMethod = path.pop()! as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';
    const slashPath = path.join('/');
    let uri = `${baseUrl}/${slashPath}`;

    const [input] = opts.args as [{ data: any, query: any }]

    if (input?.query) {
      const queryParams = new URLSearchParams(input?.query)
      uri += `?${queryParams.toString()}`
    }

    const stringifiedInput = input !== undefined && !!input?.data && JSON.stringify(input.data);
    let body = restMethod === 'get' ? undefined : (stringifiedInput || undefined);

    const response = await fetch(uri, {
      method: restMethod,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    })

    if (response.ok) {
      return {
        response,
        data: await response.json() as Promise<TRPCResponse>,
        error: null,
      }
    } else {
      let errorData;

      try {
        errorData = await response.json()
      } catch (_err) { }

      return {
        response,
        data: null,
        error: errorData as TError
      }
    }
  }) as DecoratedProcedureRecord<TRouter['_def']['record'], TError>;
