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
class GameState(Enum):
    PLANNING = "Planning moves",
    EXECUTING = "Missiles flying",
    FINISHED = "Game over"

ROOM_NAME_LENGTH = 4

class PlayerAction(Enum):
    Fire = "Fire Missile"
    Shield = "Use Shield"
class Message:

    mapping = {}

    def __init__(self, json_blob, not_full_message=False):
        self.json = json_blob
        if not not_full_message:
            self.type = self.process_string("type")

        
    def process_string(self, property_name, max_length=20):
        if property_name not in self.json:
            raise SyntaxError(f"No {property_name} in message")

        stringy = nh3.clean(str(self.json[property_name]))
        #regex only alphabet characters
        pattern = re.compile('[\W_]+')
        #apply regex
        stringy = pattern.sub('', stringy)
        if len(stringy) > max_length:
            stringy = stringy[:max_length]
        return stringy

    def process_enum(self, property_name, enum):
        value = self.process_string(property_name)
        # if value in enum:
        try:
            returnthis = enum[value]
            return returnthis
        except:
            raise ValueError(f"Not a valid {enum.__name__}")

    def process_float(self, property_name):
        if property_name not in self.json:
            raise SyntaxError(f"No {property_name} in message")
        value = float(self.json[property_name])

        return value

    def process_int(self, property_name):
        if property_name not in self.json:
            raise SyntaxError(f"No {property_name} in message")
        value = int(self.json[property_name])

        return value

    def process_boolean(self, property_name):
        if property_name not in self.json:
            raise SyntaxError(f"No {property_name} in message")
        value = bool(self.json[property_name])

        return value

    def process_array(self, property_name, object_class):
        if property_name not in self.json:
            raise SyntaxError(f"No {property_name} in message")
        array_in = self.json[property_name]
        array_out = []
        if isinstance(array_in, list):
            for element in array_in:
                array_out.append(object_class(element))
        return array_out


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

class PlayerPlanMessage(Message):
    def __init__(self, json_blob):
        super().__init__(json_blob)
        self.angle = 0
        self.action = self.process_enum("action", PlayerAction)
        if self.action == PlayerAction.Fire:
            self.angle = self.process_float("angle")

class ExecutionFinishedMessage(Message):
    '''
    After all the missiles have flown
    '''

    class PlayerState(Message):
        def __init__(self, json_blob):
            super().__init__(json_blob, not_full_message=True)
            self.index = self.process_int("index")
            self.alive = self.process_boolean("alive")
        def to_json(self):
            return {
                "index": self.index,
                "alive": self.alive
            }

    def __init__(self, json_blob):
        super().__init__(json_blob)
        self.players = self.process_array("players", ExecutionFinishedMessage.PlayerState)
        self.game_over = self.process_boolean("gameOver")

    def to_json(self):
        return {
            "type": "ExecutionFinished",
            "gameOver": self.game_over,
            "players": [player.to_json() for player in self.players]
        }


Message.mapping["CreateRoom"]= CreateRoomMessage
Message.mapping["ChangeName"]= ChangeNameMessage
Message.mapping["JoinRoom"]= JoinRoomMessage
Message.mapping["StartGame"]= StartGameMessage
Message.mapping["PlayerPlan"]= PlayerPlanMessage
Message.mapping["ExecutionFinished"]= ExecutionFinishedMessage

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
        await self.message_processor.remove_client(self)


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
        print("room get_players")
        print(self.clients)
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
            if client == self.host:
                await self.start_game(message)
                print("Starting game")
        else:
            raise ValueError("Message type not applicable for current state")

    async def start_game(self, message):
        message.set_players(self.get_players())
        for i,client in enumerate(self.clients):
            await client.websocket.send(json.dumps(message.to_json(player_index=i)))
        game = Game(self.clients[:], self.handler, self.get_room_info())
        self.handler.master_lobby.add_game(game)
        for client in self.clients:
            client.state_change(game)
        self.clients = []

    async def cleanup(self):
        await super().cleanup()
        #remove any references
        print(f"Room {self.name} shuttingdown")


# class Player:
#     def __init__(self, inde):

'''
trying to decide best approach.one game object per room
does this break with the idea of having each state as a MessageResponder?

going back to all being MessageResponders and it'll phone home to keep a list of games
'''
class Game(MessageResponder):
    class Plan:
        def __init__(self, message, player_index):
            self.player_index = player_index
            # # PlayerAction
            self.message = message
            # self.action = message.action
            # # message object has already done these based on the message type
            # self.angle = message.angle
        def to_json(self):
            blob = {
                "player": self.player_index,
                "action": self.message.action.name,
                "angle": self.message.angle
            }
            # if self.angle >= 0:
            #     blob["angle"] = self.angle

            return blob
    #
    # class Result:
    #     '''
    #     ties a ExecutionFinished message to a player index
    #
    #     '''
    #     def __init__(self, message, player_index):
    #         self.players = message.players[:]
    #         self.player_index = player_index
    class TurnResult:
        def __init__(self, message, player_index):
            self.message = message
            self.player_index = player_index

        def alive_players(self):
            alive = []
            for player in self.message.players:
                if player.alive:
                    alive.append(player.index)
            return alive


        def compare(self, another_result):
            #TODO, more thoroughly check results from other players are actually the same
            return len(self.alive_players()) == len(another_result.alive_players()) and self.message.game_over == another_result.message.game_over
            # if another_result.message.players

    class Turn:
        def __init__(self):
            self.plans = []
            self.results = []

        def add_plan(self, plan):
            '''

            :param plan: a Plan with PlayerPlan message
            :return:
            '''
            for existing_plan in self.plans:
                if existing_plan.player_index == plan.player_index:
                    raise ValueError("Already received plan for this player")
            self.plans.append(plan)

        def add_result(self, result):
            '''
            a Result with ExecutionFinished message
            :param result:
            :return:
            '''
            for existing_result in self.results:
                if existing_result.player_index == result.player_index:
                    raise ValueError("Already received result for this player")
            if len(self.results) > 0:
                if not self.results[0].compare(result):
                    raise ValueError("Result doesn't agree with other received results.")
            self.results.append(result)


    def __init__(self, clients, handler, room_info):
        super().__init__(clients,handler)
        #extending from room would be nice but too much doesn't align. just pretend to be a roomish for the master lobby
        self.name=room_info["name"]
        self.private = room_info["private"]
        # [ {"colour": "rgb", "index": int, "client": clientObject/None} ]
        self.players = []
        i=0
        for client in clients:
            player = {
                "index": i,
                "client": client,
                # "colour": TODO
            }
            self.players.append(player)
            i+=1

        # self.room_info = room_info
        self.state = GameState.PLANNING
        #list of lists of plans:
        # self.plans = [[]]
        self.turns = [Game.Turn()]

    async def process_message(self, message, client):
        if message.type == "PlayerPlan":
            await self.process_player_plan(message, client)
        elif message.type == "ExecutionFinished":
            await self.process_execution_finished(message, client)
        else:
            raise ValueError("Message type not applicable for current state")

    async def process_execution_finished(self, message, client):
        if self.state != GameState.EXECUTING:
            raise ValueError(f"Not in executing state, invalid to submit results from player {self.get_player_index(client)}")
        self.turns[-1].add_result(Game.TurnResult(message, self.get_player_index(client)))
        if self.got_from_all_players(self.turns[-1].results):
            await self.finish_execution()

    async def finish_execution(self):
        '''
        if there are multiple players still alive, go back to planning and continue the round
        :return:
        '''
        game_over = len(self.turns[-1].results[0].alive_players()) <= 1
        print(f"Alive players: {self.turns[-1].results[0].alive_players()}")
        if game_over:
            print(f"Game {self.name} finished! ")
            #TODO

        if game_over != self.turns[-1].results[0].message.game_over:
            raise ValueError("Doesn't look like there are enough players left alive for the game to not be over?")

        self.broadcast(self.turns[-1].results[0].message.to_json())
        self.turns.append(Game.Turn())
        if game_over:
            self.state = GameState.FINISHED
        else:
            self.state = GameState.PLANNING



    def get_player_index(self, client):
        clients = [player["client"] for player in self.players]
        try:
            index = clients.index(client)
        except:
            raise ValueError("player not found for client")
        return index

    ''' send the plans to all players for the game to run'''
    async def execute_plans(self):
        message = {
            "type": "ExecutePlans",
            "plans": []
        }
        for plan in self.turns[-1].plans:
            message["plans"].append(plan.to_json())
        message_string = json.dumps(message)
        self.state = GameState.EXECUTING
        for client in self.clients:
            await client.websocket.send(message_string)

    def got_from_all_players(self, got_from_list):
        #got a plan for every currently connected client
        ready_player_indexes = [plan.player_index for plan in got_from_list]
        for client in self.clients:
            if self.get_player_index(client) not in ready_player_indexes:
                return False
        return True


    async def process_player_plan(self, message, client):
        if self.state != GameState.PLANNING:
            raise ValueError(f"Not in planning state, invalid to submit plan from player {self.get_player_index(client)}")
        self.turns[-1].add_plan(Game.Plan(message, self.get_player_index(client)))
        if self.got_from_all_players(self.turns[-1].plans):
            print(f"Game {self.name} has received all plans")
            #got all the plans for the currently connected clients (happy to skip disconnected players for now)
            await self.execute_plans()
    #
    # async def send_info(self):
    #     #do nothing, just to override Room's send_info
    #     pass

    async def remove_client(self, client):
        await super().remove_client(client)
        for player in self.players:
            if player["client"] is client:
                player["client"] = None

    async def cleanup(self):
        await super().cleanup()
        #remove any references
        print(f"Game {self.name} shutting down")

class MasterLobby(MessageResponder):
    def __init__(self, handler):
        super().__init__([], handler)
        self.rooms = []
        self.games = []


    def prune(self):
        #TODO any reference cleanup needed in room or game?
        self.rooms = [room for room in self.rooms if room.client_count() > 0]
        self.games = [game for game in self.games if game.client_count() > 0]
        self.broadcast_info()

    def add_game(self, game):
        self.games.append(game)
        self.broadcast_info()

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
        self.clients.remove(client)
        room = Room(client, self.handler, room_name, message.private)
        await room.send_info()
        self.rooms.append(room)

        client.state_change(room)
        # print(f"Created room {room_name}")
        self.broadcast_info()

    async def add_client(self, client):
        self.clients.append(client)
        self.broadcast_info()

    def broadcast_info(self):
        print("Broadcasting room and game info")
        #give all clients up to date room and game list
        message = {
            "type": "LobbyInfo",
            "rooms": [room.name for room in self.rooms if not room.private],
            "games": [game.name for game in self.games if not game.private]
        }
        self.broadcast(message)


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
                await self.cleanup(client)
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

    async def cleanup(self, client):
        await client.cleanup()
        self.clients.remove(client)
        self.master_lobby.prune()
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
