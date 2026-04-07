
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

    getRawProperty(propertyName){
        if(!(propertyName in this.json)){
            throw new Error(`Message does not have property ${propertyName}`);
        }
        return this.json[propertyName];
    }

    getString(propertyName){
        // TODO ?
        return this.getRawProperty(propertyName);
    }

    getBoolean(propertyName){
        return this.getRawProperty(propertyName) === true;
    }

    getInt(propertyName){
        return parseInt(this.getRawProperty(propertyName));
    }
}

class RoomInfoMessage extends Message{
    constructor(json){
        super(json);
        if (this.type != "RoomInfo"){
            throw new Error("Message not RoomInfo");
        }

        this.name = String(this.getString("name"));
        this.players = this.getRawProperty("players");
        this.private = this.getString("private");
        //first player is always the host at the moment
        this.host_index = this.getInt("host_index");
        this.host = this.getBoolean("host");
        if(!Array.isArray(this.players)){
            throw new Error ("players is not an array");
        }

    }
}

Message.mapping = {"RoomInfo": RoomInfoMessage};

/**
 * Base class for all the objects which control game state adn respond to messages
 */
class MessageResponder{

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

    send(messageObject){
        this.websocket.send(JSON.stringify(messageObject));
    }
}


export class PlanetWarsSocketClient{
    constructor(websocket){
        this.websocket = websocket;
        this.messageResponder = new MasterLobby(websocket, (newmessageResponder) => {
            this.messageResponder.cleanUp();
            this.messageResponder = newmessageResponder;
        })
        this.websocket.addEventListener("message", (event) => {
            console.log("Message from server ", event.data);
            let message = Message.processMessage(JSON.parse(event.data));

            this.messageResponder.processMessage(message);

            
        });
    }

    
}

/**
 * Not going to be very MVC, view logic is going to be a bit intermingled with main logic.
 * Wondering if I should switch to something like angular, or how easy it would be to rig up something that can read all the state to update the UI
 * separate object which controls UI from the state of these objects?
 * for now, hacky hacky with lots of document.getElementById. will think about doing properly later
 */
class MasterLobby extends MessageResponder{
    constructor(websocket, stateChangeCallback){
        super(websocket, stateChangeCallback)

        this.mainDiv = document.getElementById('planet_wars_master_lobby');
        this.mainDiv.classList.remove("hidden");
        this.joinForm = document.getElementById("planet_wars_join_room_form");
        this.joinForm.reset();
        this.nameBox = document.getElementById("planet_wars_player_name");
        // this.nameBox.reset();
        
        this.joinForm.onsubmit = (event) =>{
            event.preventDefault();
            let message = {
                "type": "JoinRoom",
                "room": event.target.elements.roomName.value
            }
            this.send(message);
            return false;
        }
        document.getElementById("planet_wars_create_room_form").onsubmit = (event) =>{
            event.preventDefault();
            let message = {
                "type": "CreateRoom",
                "private": event.target.elements.private.value == "on"
            }
            this.send(message);
            return false;
        }
        this.nameBox.onkeyup = (event) =>{
            console.log(event);
            this.updateName();
        }
        // this.nameBox.onkeyup();
        // this.updateName();
    }

    updateName(){
        let message = {
            "type": "ChangeName",
            "name": document.getElementById("planet_wars_player_name").value
        }
        if(message["name"].length > 0){
            this.send(message);
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


class Room extends MessageResponder{
    constructor(websocket, stateChangeCallback, roomMessage){
        super(websocket, stateChangeCallback)
        this.roomInfo = roomMessage;
        this.mainDiv = document.getElementById("planet_wars_room");
        this.nameSpan = this.mainDiv.querySelector("#room_name");
        this.privateSpan = this.mainDiv.querySelector("#room_private");
        this.playersList = this.mainDiv.querySelector("#players")
        this.playForm = this.mainDiv.querySelector("#play_form")
        this.host = false;

        this.processRoomInfo(this.roomInfo);
        

        this.playForm.onsubmit = (event) =>{
            event.preventDefault();
            // start the game already!
            // send off settings (when they exist)
            let message = {
                "type": "StartGame",
                // "private": event.target.elements.private.value == "on"
            }
            this.send(message);
            return false;
        }

        this.mainDiv.classList.remove("hidden");
        

    }

    processMessage(message){
        switch(message.type){
            case "RoomInfo":
                this.processRoomInfo(message)
                break;
        }
    }

    isHost(){
        // this will get more complicated at some point
        return this.host;
    }

    processRoomInfo(roomInfo){
        this.roomInfo = roomInfo;
        this.nameSpan.innerHTML = this.roomInfo.name;
        this.privateSpan.innerHTML = "";
        if (roomInfo.private){
            this.privateSpan.innerHTML = " (private)";
        }
        this.playersList.innerHTML = "";
        for(const player of roomInfo.players){
            this.playersList.innerHTML += `<li>${player}</li>`;
        }
        let playButtonVisible = roomInfo.players.length >= 2;
        if (playButtonVisible && this.isHost()){
            this.playForm.classList.remove("hidden");
        }else{
            this.playForm.classList.add("hidden");
        }
        this.host = roomInfo.host;


    }

    cleanUp(){
        super.cleanUp();
        this.mainDiv.classList.add("hidden");

    }

}