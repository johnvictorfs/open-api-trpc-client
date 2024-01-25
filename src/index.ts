import { createOpenApiClient } from "./client";
import { ApiRouter } from "./generated";

const testStuff = async () => {
  const litestarClient2 = createOpenApiClient<ApiRouter>('http://127.0.0.1:8000');
  const userId = '99'
  const data = await litestarClient2.users.profile[userId].get.query()
  console.log(`age: ${data?.age}`)
}

testStuff()
