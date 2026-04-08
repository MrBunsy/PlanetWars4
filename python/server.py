#!/bin/python

import asyncio
import html
import json
import string
import random
import re

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

# class ClientState(Enum):
#     MASTER_LOBBY = "In master lobby"
#     WAITING_ROOM = "In a waiting room"
#     GAME = "In game"
#
# class ClientSubState(Enum):
#     WAITING = "Waiting"

ROOM_NAME_LENGTH = 4

class Message:

    mapping = {}

    def __init__(self, json_blob):
        self.json = json_blob
        self.type = self.process_string("type")

        
    def process_string(self, property_name, max_length=20):
        if property_name not in self.json:
            raise SyntaxError(f"No {property_name} in message")

        stringy = nh3.clean(str(self.json[property_name]))
        pattern = re.compile('[\W_]+')
        stringy = pattern.sub('', stringy)
        if len(stringy) > max_length:
            stringy = stringy[:max_length]
        return stringy

    @staticmethod
    def process_json(json_blob):
        base_message = Message(json_blob)
        message = Message.mapping[base_message.type](json_blob)
        return message

class CreateRoomMessage(Message):
    def __init__(self, json_blob):
        super().__init__(json_blob)
        self.private = bool(self.json["private"])

class ChangeNameMessage(Message):
    def __init__(self, json_blob):
        super().__init__(json_blob)
        self.name = self.process_string("name")

class JoinRoomMessage(Message):
    def __init__(self, json_blob):
        super().__init__(json_blob)
        self.room = self.process_string("room", max_length=ROOM_NAME_LENGTH)

class StartGameMessage(Message):
    '''
    Recived from client with game settings to trigger game start.
    broadcast back to clients with more details to start the game
    '''
    def __init__(self, json_blob):
        super().__init__(json_blob)
        # there aren't any game settings yet
        # these will be sent back to clients
        self.seed = random.randint(0, 999999)
        self.players = []

    def set_players(self, players):
        self.players = players

    def to_json(self, player_index=0):
        return {
            "type": "StartGame",
            "seed" : self.seed,
            "players": self.players,
            "player_index" : player_index
        }

Message.mapping["CreateRoom"]= CreateRoomMessage
Message.mapping["ChangeName"]= ChangeNameMessage
Message.mapping["JoinRoom"]= JoinRoomMessage
Message.mapping["StartGame"]= StartGameMessage
class Client:


    def __init__(self, websocket, message_processor, name="Unnamed Player"):
        self.websocket = websocket
        self.name = name
        # self.state = ClientState.MASTER_LOBBY
        # self.sub_state = ClientSubState.WAITING
        self.message_processor = message_processor

    def state_change(self, new_message_processor):
        # self.message_processor.cleanup()
        self.message_processor = new_message_processor

    async def process_message(self, message):
        print(f"client processing message type: {message.type}")
        await self.message_processor.process_message(message, self)

    async def cleanup(self):
        self.message_processor.remove_client(self)


class MessageResponder:
    '''
    Mirroring the JS: an object for each major state which will process the messages from clients
    if the state transitions, handler.state_change will be called and passed the new MessageResponder sub class
    '''
    def __init__(self, clients, handler):
        self.clients = clients
        self.handler = handler

    async def process_message(self, message, from_client):
        raise NotImplementedError("implement in subclasses")

    async def cleanup(self):
        self.clients = set()
        # self.handler = None
    async def remove_client(self, client):
        if client in self.clients:
            self.clients.remove(client)

    def client_count(self):
        return len(self.clients)

    def broadcast(self, message):
        broadcast([client.websocket for client in self.clients], json.dumps(message))


class Room(MessageResponder):
    def __init__(self, host, handler, name, private=True):
        super().__init__([host], handler)
        print(f"Created room {name}")
        self.host_index = 0
        self.host = host
        self.name = name
        # self.clients = []
        self.private = private
        # await self.send_info()
    async def add_client(self, client):
        self.clients.append(client)
        await self.send_info()


    async def send_info(self):
        print("Sending room info")
        message = self.get_room_info()
        message["type"]= "RoomInfo"
        # broadcast([client.websocket for client in self.clients], json.dumps(message))
        # self.broadcast(message)
        for client in self.clients:
            message["host"] = client == self.host
            print(f"Sending room info to {client.name}")
            await client.websocket.send(json.dumps(message))

    def get_room_info(self, for_host=False):
        return {
            "name" : self.name,
            "players": self.get_players(),
            "private": self.private,
            "host_index": self.host_index,
            "host": for_host
        }

    def get_players(self):
        return [client.name for client in self.clients]

    async def remove_client(self, client):
        await super().remove_client(client)
        if len(self.clients) == 0:
            await self.cleanup()
        else:
            await self.send_info()
    async def process_message(self, message, client):
        if message.type == "StartGame":
            # self.join_room(client, message)
            await self.start_game(message)
            print("Starting game")
        else:
            raise ValueError("Message type not applicable for current state")

    async def start_game(self, message):
        message.set_players(self.get_players())
        for i,client in enumerate(self.clients):
            await client.websocket.send(json.dumps(message.to_json(player_index=i)))
        # self.broadcast(message.to_json())

    async def cleanup(self):
        await super().cleanup()
        #remove any references
        print(f"Room {self.name} shuttingdown")

class MasterLobby(MessageResponder):
    def __init__(self, handler):
        super().__init__([], handler)
        self.rooms = []


    def prune_rooms(self):
        self.rooms = [room for room in self.rooms if room.client_count() > 0]

    async def process_message(self, message, client):
        print(f"master lobby processing message type: {message.type}")
        if message.type == "JoinRoom":
            await self.join_room(client, message)
        elif message.type == "CreateRoom":
            await self.create_room(client, message)
        elif message.type == "ChangeName":
            self.change_name(client, message)
        else:
            raise ValueError("Message type not applicable for current state")
    # def cleanup(self):
    #     super().cleanup()
    def find_room(self, name):
        for room in self.rooms:
            if room.name == name:
                return room
        raise FileNotFoundError("Cannot find room")

    def change_name(self, client, message):
        print(f"Client new name: {message.name}")
        client.name = message.name

    async def join_room(self, client, message):
        print("Joining room")
        room = self.find_room(message.room)
        print(f"found room: {room}")
        self.clients.remove(client)
        client.state_change(room)
        await room.add_client(client)

    async def create_room(self, client, message):
        room_name = ''.join(random.choice(string.ascii_uppercase) for i in range(ROOM_NAME_LENGTH))
        room = Room(client, self.handler, room_name, message.private)
        await room.send_info()
        self.rooms.append(room)
        self.clients.remove(client)
        client.state_change(room)
        print(f"Created room {room_name}")

    async def add_client(self, client):
        self.clients.append(client)


# def sanitise_string(input, max_length=20):
#     out = str(input)
#     if len(out) > max_length:
#         out = out[:max_length]
#     return nh3.clean(out)

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
        self.master_lobby = MasterLobby(self)


    async def join(self, websocket):
        #drop straight into the master lobby
        client = Client(websocket, self.master_lobby)
        await self.master_lobby.add_client(client)
        self.clients.add(client)
        print(f"New Master Lobby client, total: {len(self.clients)}")
        while True:
            try:
                message_json = await client.websocket.recv()
                print(message_json)

            except:
                # ConnectionClosed
                self.cleanup(client)
                print(f"Total connected clients: {len(self.clients)}")
                break
            try:
                json_blob = json.loads(message_json)
                message = Message.process_json(json_blob)
                print(f"Processed message type: {message.type}")

                await client.process_message(message)

            except Exception as e:
                print(f"Failed to process a message: "+str(e))
                response = {"type": "Error", "detail": "Cannot parse message"}
                await client.websocket.send(json.dumps(response))

    def cleanup(self, client):
        client.cleanup()
        self.clients.remove(client)
        self.master_lobby.prune_rooms()
        #kick out of any rooms they were in
        # self.master_lobby.remove_client(client)
        #shut the room down if there's no-one left
        #self.rooms = [room for room in self.rooms if room.client_count() > 0]



    # def process_message(self,client, message):
    #     '''
    #     will raise exceptiosn willy nilly with errors
    #     :param message:
    #     :return:
    #     '''
    #     self.message_processor.process_message(message, client)
    #     # if client.state == ClientState.MASTER_LOBBY:
    #     #     if message["type"] == "JoinRoom":
    #     #         self.join_room(client, message)
    #     #     elif message["type"] == "CreateRoom":
    #     #         self.create_room(client, message)
    #     #     else:
    #     #         raise ValueError("Message type not applicable for current state")




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
