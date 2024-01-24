from litestar import Litestar, get, post
from typing import TypedDict, NotRequired


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


@get("/users/{user_id: int}")
async def get_user(user_id: int) -> User | None:
    for user in users:
        if user["id"] == user_id:
            return user

    return None


@get("/users/profile/{user_id: int}")
async def get_user_profile(user_id: int) -> Profile | None:
    for user in users:
        if user["id"] == user_id:
            if "profile" not in user:
                return None

            return user["profile"]

    return None


@post("/users")
async def create_user(data: User) -> User:
    users.append(data)
    return data


app = Litestar(route_handlers=[get_user, get_user_profile, create_user])
