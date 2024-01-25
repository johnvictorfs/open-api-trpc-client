// This file is auto-generated and will be overwritten. Do not manually make changes
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

export type ApiRouter = CreateRouterInner<FakeConfig, {
  users:  CreateRouterInner<FakeConfig, {
  post: MutationProcedure<{
data: { id: number, username: string, email: string, level: number, profile?: { name: string, age: number } }, 
}, { id: number, username: string, email: string, level: number, profile?: { name: string, age: number } }>}>
   &  CreateRouterInner<FakeConfig, {
    [user_id: string]:  CreateRouterInner<FakeConfig, {
    get: QueryProcedure<void, null | { id: number, username: string, email: string, level: number, profile?: { name: string, age: number } }>}>,
  }>
   &  CreateRouterInner<FakeConfig, {
    profile:  CreateRouterInner<FakeConfig, {
      [user_id: string]:  CreateRouterInner<FakeConfig, {
      get: QueryProcedure<void, null | { name: string, age: number }>}>,
  }>,
    }>
   &  CreateRouterInner<FakeConfig, {
    search:  CreateRouterInner<FakeConfig, {
      [user_type: string]:  CreateRouterInner<FakeConfig, {
        submit:  CreateRouterInner<FakeConfig, {
        post: MutationProcedure<{
data: { name: string, age: number }, query: {sort_by?: 'name' | 'email' | null,
order?: null | string,
}, 
}, { id: number, username: string, email: string, level: number, profile?: { name: string, age: number } }>}>,
  }>,
    }>,
      }>
   &  CreateRouterInner<FakeConfig, {
    search:  CreateRouterInner<FakeConfig, {
      [user_type: string]:  CreateRouterInner<FakeConfig, {
        do_thing:  CreateRouterInner<FakeConfig, {
        post: MutationProcedure<{
data: { name: string, age: number }, query: {sort_by?: 'name' | 'email' | null,
order?: null | string,
}, 
}, { id: number, username: string, email: string, level: number, profile?: { name: string, age: number } }>}>,
  }>,
    }>,
      }>
}>
