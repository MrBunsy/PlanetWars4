
/**
 * message structure:
 * 
 * {type: "LobbyList"
 *  rooms: ["name", "name2",...]
 * }
 * 
 * for joining a room or updating current room:
 * {type: "RoomInfo", name:"roomname", players:["playername"]}
 * 
 * 
 */

function messageIsType(type){
    return (message.hasOwnProperty("type") && message["type"] == type)
}

class Message{
    static mapping = {};

    static processMessage(json){
        let baseMessage = new Message(json);
        let message = new Message.mapping[baseMessage.type](json);
        return message;

    }

    constructor(messageJSON) {
        this.json = messageJSON;
        if(!("type" in this.json)){
            throw new Error("Cannot parse message, no type");
        }
        this.type = this.json["type"];
    }

    getProperty(propertyName, propertyType){
        if(!(propertyName in this.json)){
            throw new Error(`Message does not have property ${propertyName}`);
        }
        // if(!(typeof this.json[propertyName] != propertyType)){
        //     throw new Error(`Property ${propertyName} is not type ${propertyType}`)
        // }
        return this.json[propertyName];
    }
}

class RoomInfoMessage extends Message{
    constructor(json){
        super(json);
        if (this.type != "RoomInfo"){
            throw new Error("Message not RoomInfo");
        }

        this.name = String(this.getProperty("name", "string"));
        this.players = this.getProperty("players");
        if(!Array.isArray(this.players)){
            throw new Error ("players is not an array");
        }

    }
}

Message.mapping = {"RoomInfo": RoomInfoMessage};


class SocketCommsState{

    constructor(websocket, stateChangeCallback){
        this.websocket = websocket;
        this.stateChangeCallback = stateChangeCallback;
    }

    processMessage(message){
        console.log(message)
    }

    cleanUp(){
        this.stateChangeCallback = null;
    }
}


export class PlanetWarsSocketClient{
    constructor(websocket){
        this.websocket = websocket;
        this.stateProcessor = new MasterLobby(websocket, (newStateProcessor) => {
            this.stateProcessor.cleanUp();
            this.stateProcessor = newStateProcessor;
        })
        this.websocket.addEventListener("message", (event) => {
            console.log("Message from server ", event.data);
            let message = Message.processMessage(JSON.parse(event.data));

            this.stateProcessor.processMessage(message);

            
        });
    }
}

/**
 * Not going to be very MVC, view logic is going to be a bit intermingled with main logic.
 * Wondering if I should switch to something like angular, or how easy it would be to rig up something that can read all the state to update the UI
 * for now, hacky hacky with lots of document.getElementById. will think about doing properly later
 */
class MasterLobby extends SocketCommsState{
    constructor(websocket, stateChangeCallback){
        super(websocket, stateChangeCallback)

        this.mainDiv = document.getElementById('planet_wars_master_lobby');
        this.mainDiv.classList.remove("hidden");

        this.stateProcessor

        
        document.getElementById("planet_wars_join_room_form").onsubmit = (event) =>{
            event.preventDefault();
            let message = {
                "type": "JoinRoom",
                "room": event.target.elements.roomName.value
            }
            this.websocket.send(JSON.stringify(message))
            return false;
        }
        document.getElementById("planet_wars_create_room_form").onsubmit = (event) =>{
            event.preventDefault();
            let message = {
                "type": "CreateRoom",
                "private": event.target.elements.private.value == "on"
            }
            this.websocket.send(JSON.stringify(message))
            return false;
        }
    }

    processMessage(message){
        switch(message.type){
            case "RoomInfo":
                //we have joined a room successfully
                let room = new Room(this.websocket, this.stateChangeCallback, message)
                
                this.stateChangeCallback(room);
                return true;
        }

        return false;
    }

    cleanUp(){
        super.cleanUp();
        this.mainDiv.classList.add("hidden");

    }
}


class Room extends SocketCommsState{
    constructor(websocket, stateChangeCallback, roomMessage){
        super(websocket, stateChangeCallback)
        this.roomInfo = roomMessage;
        this.mainDiv = document.getElementById("planet_wars_room");
        this.nameSpan = document.getElementById("planet_wars_room_name");
        this.processRoomInfo(this.roomInfo);

        this.mainDiv.classList.remove("hidden");
        

    }

    processMessage(message){
        switch(message.type){
            case "RoomInfo":
                this.processRoomInfo(message)
                break;
        }
    }

    processRoomInfo(roomInfo){
        this.roomInfo = roomInfo;
        this.nameSpan.innerHTML = this.roomInfo["name"];

    }

    cleanUp(){
        super.cleanUp();
        this.mainDiv.classList.add("hidden");

    }

}