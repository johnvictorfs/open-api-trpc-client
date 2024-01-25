# open-api-trpc-client

```sh
yarn add open-api-trpc-client # does not exist yet
yarn open-api-trpc-client generate-types --schema 'http://127.0.0.1:8000/schema/openapi.json' --destination ./generated/api-client.d.ts
```

```ts
import { createOpenApiClient } from 'open-api-trpc-client';
import type { ApiRouter } from "./generated/api-client";

const litestarClient = createOpenApiClient<ApiRouter>('http://127.0.0.1:8000')
const userId = '99'

// here do be some auto-completion and type-checking
// translates to `GET /users/profile/:userId`
const { data: user, error } = await litestarClient.users.profile[userId].get.query()

if (error) {
  console.error(error)
}

if (user) {
  console.log(user.age)
}
```

```ts
import { createOpenApiClient } from 'open-api-trpc-client';
import type { ApiRouter } from "./generated/api-client";

// errors example
type LiteStarError = {
  status_code: number
  detail: string
  extra?: {
    message: string
    key: string
    source: string
  }[]
}

const litestarClient = createOpenApiClient<ApiRouter, LiteStarError>('http://127.0.0.1:8000')
const userId = '99'

const { data: user, error, response } = await litestarClient.users.profile[userId].get.query()

if (error) {
  // error is typed as LiteStarError
  console.error(error.detail)
  console.error(`status code: ${response.status}`)
}
```
