import { createRecursiveProxy } from '@trpc/server/shared';
import { DecoratedProcedureRecord } from './generated';
import { TRPCResponse } from '@trpc/server/rpc';
import { AnyRouter } from '@trpc/server';

export const createOpenApiClient = <TRouter extends AnyRouter>(
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

    const queryParameters: { key: string, value: any }[] = input?.query ? Object.entries(input.query).map(([key, value]) => ({ key, value })) : []

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

    if (json && 'error' in json) {
      throw new Error(`Error: ${json.error.message}`);
    }

    return json;
  }) as DecoratedProcedureRecord<TRouter['_def']['record']>;
