#!/bin/python

import asyncio
import html
import json
import string
import random

import nh3
''''
TODO html.escape for any data that comes in
or bleach?
bleach has been deprecated :(
nh3?

nh3.clean()
'''

from websockets import ConnectionClosedOK, ConnectionClosed
from websockets.asyncio.server import serve, broadcast
from enum import Enum

sockets = []

class ClientState(Enum):
    MASTER_LOBBY = "In master lobby"
    WAITING_ROOM = "In a waiting room"
    GAME = "In game"

class ClientSubState(Enum):
    WAITING = "Waiting"

class Client:


    def __init__(self, websocket, name="Unnamed Player"):
        self.websocket = websocket
        self.name = name
        self.state = ClientState.MASTER_LOBBY
        self.sub_state = ClientSubState.WAITING

class Room:
    def __init__(self, name, private=True):
        self.name = name
        self.clients = []
        self.private = private
    def add_client(self, client):
        self.clients.append(client)
        self.send_info()


    def send_info(self):
        message = self.get_room_info()
        message["type"]= "RoomInfo"
        broadcast([client.websocket for client in self.clients], json.dumps(message))

    def get_room_info(self):
        return {
            "name" : self.name,
            "players": [client.name for client in self.clients],
            "private": self.private
        }

    def remove_client(self, client):
        if client in self.clients:
            self.clients.remove(client)
        if len(self.clients) == 0:
            self.cleanup()

    def cleanup(self):
        #remove any references
        print(f"Room {self.name} shuttingdown")

    def client_count(self):
        return len(self.clients)

def sanitise_string(input, max_length=20):
    out = str(input)
    if len(out) > max_length:
        out = out[:max_length]
    return nh3.clean(out)

'''
When the page first loads a client won't be in a lobby or a game. They will be in the MasterLobby which allows them to create a lobby
or join a public lobby

idea - this should be a ClientHandler and remains the only while loop per client
then it interacts with the room and game objects with the received messages on behalf of the client?

'''
class ClientHandler:


    def __init__(self):
        '''

        '''
        self.clients = set()
        self.rooms = []

    async def join(self, websocket):
        client = Client(websocket)
        self.clients.add(client)
        print(f"New Master Lobby client, total: {len(self.clients)}")
        while True:
            try:
                messageJson = await client.websocket.recv()
                print(messageJson)
            except:
                # ConnectionClosed
                self.cleanup(client)
                print(f"Master Lobby lost client, total: {len(self.clients)}")
                break
            try:
                message = json.loads(messageJson)
                self.process_message(client, message)


            except Exception as e:
                print(f"Failed to process a message")
                response = {"type": "Error", "detail": "Cannot parse message: "+e}
                await client.websocket.send(json.dumps(response))

    def cleanup(self, client):
        self.clients.remove(client)
        #kick out of any rooms they were in
        for room in self.rooms:
            room.remove_client(client)
        #shut the room down if there's no-one left
        self.rooms = [room for room in self.rooms if room.client_count() > 0]



    def process_message(self,client, message):
        '''
        will raise exceptiosn willy nilly with errors
        :param message:
        :return:
        '''
        if client.state == ClientState.MASTER_LOBBY:
            if message["type"] == "JoinRoom":
                self.join_room(client, message)
            elif message["type"] == "CreateRoom":
                self.create_room(client, message)
            else:
                raise ValueError("Message type not applicable for current state")

    def find_room(self, name):
        for room in self.rooms:
            if room.name == name:
                return room
        raise FileNotFoundError("Cannot find room")


    def join_room(self, client, message):

        room = self.find_room(sanitise_string(message["room"], max_length=4))

        # self.clients.remove(client)
        room.add_client(client)

    def create_room(self, client, message):
        room_name = ''.join(random.choice(string.ascii_uppercase) for i in range(4))
        room = Room(room_name)
        room.add_client(client)
        self.rooms.append(room)
        print(f"Created room {room_name}")


lobby = ClientHandler()

async def handler(websocket):
    await lobby.join(websocket)
    # # sockets.append(websocket)
    # print(f"New client, total: {len(sockets)}")
    # while True:
    #     try:
    #         message = await websocket.recv()
    #     except:
    #         # ConnectionClosed
    #         sockets.remove(websocket)
    #         print(f"Lost client, total: {len(sockets)}")
    #         break
    #     print(message)
    #     # for socket in sockets:
    #     #     await socket.send(message)
    #     broadcast(sockets, message)


async def main():

    async with serve(handler, "127.0.0.1", 8000) as server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
