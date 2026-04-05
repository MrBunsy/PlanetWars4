#!/bin/python

import asyncio

from websockets import ConnectionClosedOK, ConnectionClosed
from websockets.asyncio.server import serve

# async def echo(websocket):
#     async for message in websocket:
#         print(message)
#         await websocket.send(message)
#
# async def main():
#     async with serve(echo, "127.0.0.1", 8000) as server:
#         await server.serve_forever()
#
# asyncio.run(main())

sockets = []

async def handler(websocket):
    sockets.append(websocket)
    print(f"New client, total: {len(sockets)}")
    while True:
        try:
            message = await websocket.recv()
        except:
            # ConnectionClosed
            sockets.remove(websocket)
            print(f"Lost client, total: {len(sockets)}")
            break
        print(message)
        for socket in sockets:
            await socket.send(message)


async def main():
    async with serve(handler, "127.0.0.1", 8000) as server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())

