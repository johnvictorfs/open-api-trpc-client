# open-api-trpc-client

```sh
yarn add open-api-trpc-client # does not exist yet
yarn open-api-trpc-client generate-types --schema 'http://127.0.0.1:8000/schema/openapi.json' --destination ./generated/api-client.d.ts
```

```py
# Backend code example (could be any language, just needs to have an OpenAPI definition
from litestar import Litestar, get, post
from typing import TypedDict, NotRequired
from typing import Literal


class Profile(TypedDict):
    name: str
    age: int


class User(TypedDict):
    id: int
    username: str
    email: str
    level: int
    profile: NotRequired[Profile]


users: list[User] = [
    {
        "username": "foo",
        "email": "foo@email.com",
        "level": 3,
        "id": 99,
        "profile": {"age": 22, "name": "Foo Bar"},
    },
    {"username": "bar", "email": "bar@email.com", "level": 4, "id": 88},
]

@get("/users/profile/{user_id: int}")
async def get_user_profile(user_id: int) -> Profile | None:
    for user in users:
        if user["id"] == user_id:
            if "profile" not in user:
                return None

            return user["profile"]

    return None
```

```ts
// Client code
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
// Client code
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
