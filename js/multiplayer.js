import {World} from './world.js'
import {WorldRenderer, Viewport} from './render.js'
import {Vector} from './geometry.js'
import { PlanetWarsMatch, Player } from './game.js';

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

    constructor(messageJSON, notFullMessage=false) {
        this.json = messageJSON;
        // useful to use Message to process parts of message (eg arrays of objects)
        // so not all "Messages" will have a type
        if(!notFullMessage && !("type" in this.json)){
            throw new Error("Cannot parse message, no type");
        }
        this.type = this.json["type"];
    }

    getRawProperty(propertyName, json=null){
        if (json === null){
            json = this.json
        }
        if(!(propertyName in json)){
            throw new Error(`Message does not have property ${propertyName}`);
        }
        return json[propertyName];
    }

    getString(propertyName, json=null){
        // TODO ?
        return this.getRawProperty(propertyName, json);
    }

    getBoolean(propertyName, json=null){
        return this.getRawProperty(propertyName, json) === true;
    }

    getInt(propertyName, json=null){
        return parseInt(this.getRawProperty(propertyName, json));
    }

    getFloat(propertyName, json=null){
        return parseFloat(this.getRawProperty(propertyName, json));
    }

    /**
     * For an array of an object which also dervives from Message
     * @param {*} propertyName 
     * @param {*} classType 
     * @param {*} json 
     * @returns 
     */
    getArrayOfObjects(propertyName, classType, json=null){
        let jsonArray = this.getRawProperty(propertyName, json);
        if(!Array.isArray(jsonArray)){
            throw new Error (`${propertyName} is not an array`);
        }
        let processedArray = []
        for(const jsonArrayElement of jsonArray){
            processedArray.push(new classType(jsonArrayElement));
        }
        return processedArray;
    }
    getArrayOfStrings(propertyName, json=null){
        let jsonArray = this.getRawProperty(propertyName, json);
        if(!Array.isArray(jsonArray)){
            throw new Error (`${propertyName} is not an array`);
        }
        let processedArray = []
        for(let i=0; i<jsonArray.length; i++){
            processedArray.push(this.getString(i, jsonArray));
        }
        return processedArray;
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

class LobbyInfoMessage extends Message{
    constructor(json){
        super(json);
        if (this.type != "LobbyInfo"){
            throw new Error("Message not LobbyInfo");
        }
        this.rooms = this.getArrayOfStrings("rooms")
        this.games = this.getArrayOfStrings("games")
    }
}

class ErrorMessage extends Message{
    constructor(json){
        super(json);
        this.detail = this.getString("detail")
    }
}

class StartGameMessage extends Message{
    constructor(json){
        super(json);
        this.seed = this.getInt("seed")
        this.players = this.getArrayOfStrings("players");
        this.playerIndex = this.getInt("player_index");
    }
}

class Plan extends Message{
    constructor(json){
        super(json, true);
        this.player = this.getInt("player");
        this.action = this.getString("action");
        if(!["Fire", "Shield"].includes(this.action)){
            throw new Error(`Player action (${this.action}) not recognised`)
        }
        this.angle = this.getFloat("angle");
    }
}

class ExecutePlansMessage extends Message{
    constructor(json){
        super(json);
        this.plans = this.getArrayOfObjects("plans", Plan);
    }
}

class PlayerInfo extends Message{
    constructor(json){
        super(json, true);
        this.index = this.getInt("index");
        this.alive = this.getBoolean("alive");
        // this.name = this.getString("name");
    }
}

class ExecutionFinishedMessage extends Message{
    constructor(json){
        super(json);
        this.players = this.getArrayOfObjects("players", PlayerInfo)
        this.gameOver = this.getBoolean("gameOver")
    }
}

Message.mapping = {
    "RoomInfo": RoomInfoMessage,
    "Error": ErrorMessage,
    "StartGame": StartGameMessage,
    //list of every player's plan to execute simultaniously
    "ExecutePlans": ExecutePlansMessage,
    "LobbyInfo": LobbyInfoMessage,
    //we send one to the server with our simulation results, then we get one back from the server to confirm
    "ExecutionFinished": ExecutionFinishedMessage,
    //when we connect to the server for the first time
    "Hello": Message,
};

/**
 * Base class for all the objects which control game state adn respond to messages
 */
class MessageResponder{

    constructor(websocket, stateChangeCallback){
        this.websocket = websocket;
        this.stateChangeCallback = stateChangeCallback;
    }

    processMessage(message){
        switch(message.type){
            case "Error":
                //we have joined a room successfully
                alert(message.detail);
                return true;
        }
        return false;
    }

    cleanUp(){
        this.stateChangeCallback = null;
    }

    send(messageObject){
        console.log(`Sending: ${JSON.stringify(messageObject)}`)
        this.websocket.send(JSON.stringify(messageObject));
    }
}


export class PlanetWarsSocketClient{
    constructor(websocket){
        this.websocket = websocket;
        // callback for when we change state
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
        this.roomListing = this.mainDiv.querySelector("#room_list");

        // websocket.addEventListener("open", (event) => {
        //     // socket.send("Hello Server!");
        //     });
        
        this.joinForm.onsubmit = (event) =>{
            event.preventDefault();
            this.joinRoom(event.target.elements.roomName.value)
            
            return false;
        }
        document.getElementById("planet_wars_create_room_form").onsubmit = (event) =>{
            event.preventDefault();
            let message = {
                "type": "CreateRoom",
                "private": event.target.elements.private.checked
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
    joinRoom(name){
        let message = {
            "type": "JoinRoom",
            "room": name
        }
        this.send(message);
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
        super.processMessage(message);
        switch(message.type){
            // case "Hello":
            //     //now connected to the server, fire off our name
            //     // ah, this worked when server was set to cache, but now it disables cache we never keep our name in the form.
            //     // TODO cookies!
            //     this.updateName();
            // break;
            case "RoomInfo":
                //we have joined a room successfully
                let room = new Room(this.websocket, this.stateChangeCallback, message)
                
                this.stateChangeCallback(room);
                return true;
            case "LobbyInfo":
                this.roomListing.innerHTML = ""
                for(const room of message.rooms){
                    let roomElement = document.createElement("li");
                    roomElement.innerHTML = room;
                    roomElement.onclick =(e) => {
                        this.joinRoom(room);
                    }
                    this.roomListing.appendChild(roomElement);
                }
            return true;
        }

        return false;
    }

    cleanUp(){
        super.cleanUp();
        this.mainDiv.classList.add("hidden");

    }
}

class Game extends MessageResponder{
    constructor(websocket, stateChangeCallback, gameMessage){
        super(websocket, stateChangeCallback)
        this.gameMessage = gameMessage;
        this.playerIndex = this.gameMessage.playerIndex
        this.mainDiv = document.getElementById("planet_wars_game");
        this.mainDiv.classList.remove("hidden");

        this.playerInfoHeader = this.mainDiv.querySelector("#player_info");
        this.gameStatusHeader = this.mainDiv.querySelector("#game_status");
        
        this.players = []
        for(let i=0; i<this.gameMessage.players.length;i++){
            this.players.push(new Player(i,this.gameMessage.players[i]));
        }

        this.game = new PlanetWarsMatch(this.mainDiv.querySelector("#game_div"), this.players);

        
        this.game.addEventListener("simulationFinished", (finishedInfo) =>{this.allMissilesFinished()})
        this.game.addEventListener("actionChosen", (actionInfo) => {
            this.actionPlanned(actionInfo)
        })

        this.game.newRound(gameMessage.seed);

        /*
         - "PLANNING": everyone chooses their action
         - "PLANNED": game still in PLANNING but we've submitted our plan
         - "EXECUTING": all the actions occur at once
         - "FINISHED": one or no players left at the end

        */
        this.state = "PLANNING";

        this.playerInfoHeader.innerHTML = `You are player ${this.playerIndex}: ${this.players[this.playerIndex].name}`
        this.playerInfoHeader.style=`color:${this.game.world.ships[this.playerIndex].colour}`
        
        // TODO proper targetting thingy like old planet wars. temporary: just click        
        //https://stackoverflow.com/a/42111623
        // document.getElementById('planet_wars2').onclick =(e) => {
        //     let rect = e.target.getBoundingClientRect();
        //     let x = e.clientX - rect.left; //x position within the element.
        //     let y = e.clientY - rect.top;  //y position within the element.
        //     let worldPos = missileViewPort.translateFromPixelToWorld(new Vector(x,y));
        //     this.clickedHere(worldPos);
        
        // }

        this.startPlanning()

    }

    startPlanning(){
        //TODO, give player choices and let them aim, etc
        this.state = "PLANNING";
        this.gameStatusHeader.innerHTML = "Choose Your Action";
        this.game.loseAllTemporaryEffects();
        if(this.players[this.playerIndex].ship.alive){
            this.game.provideActionTypeChoice(this.players[this.playerIndex]);
        }else{
            this.gameStatusHeader.innerHTML = "Your ship has been hit";
            //skip the planning state
            this.state = "PLANNED";
        }

    }

    runSimulation(){
        // this.lastUpdateTime = performance.now();
        this.state = "EXECUTING";
        this.gameStatusHeader.innerHTML = "Missiles are flying! Wait for them to hit something";
        this.game.runSimulation();
        //dim the old trails a bit
        // this.renderer.dimTrails();
        // setTimeout(this.updateSimulation.bind(this), this.delay_ms)
    }

    // updateSimulation(){
    //     let now = performance.now();
    //     let actualTimePassed_ms = now - this.lastUpdateTime;
    //     this.lastUpdateTime = now;
    //     // console.log(`Actual time passed: ${actualTimePassed_ms}ms`)
    //     for(let i =0; i<Math.floor(actualTimePassed_ms/this.physicsSteps_ms);i++){
    //         this.world.physics.update(this.simulationSpeed*this.physicsSteps_ms/1000, i==0);
    //     }
    //     this.renderer.renderAllLiveViewports();
    //     if (this.world.getLiveMissileCount() > 0){
    //         // carry on running simulation
    //         setTimeout(this.updateSimulation.bind(this), this.delay_ms)
    //     }else{
    //         //all missiles hit something
    //         this.allMissilesFinished()
    //     }
    // }

    getPlayersState(){
        //TODO get the game to update Player objects with this sort of info
        let players = [];
        for(const ship of this.game.world.ships){
            let playerState = {
                "index": ship.playerIndex,
                "alive": ship.alive,
            }
            if (!ship.alive){
                playerState["killedBy"]=ship.killedBy
            }
            players.push(playerState);
        }
        return players
    }

    allMissilesFinished(){
        let message = {
            "type":"ExecutionFinished",
            "players": this.getPlayersState(),
            //message conclusion will probably be ignored as server evalates its own decision?
            "gameOver": this.game.isGameOver(),
        }

        // server will send us to finishGame() via a ExecutionFinished message
        this.send(message)
    }

    finishGame(){
        this.state = "FINISHED"
        let survivors = this.game.getLivePlayerIndexes();
        let blurb = "Everybody's Dead, Dave";
        if (survivors.length > 0){
            blurb = `${this.players[survivors[0]].name} won!`
        }


        this.gameStatusHeader.innerHTML = `Game over: ${blurb}`;
    }

    actionPlanned(actionInfo){
        if(this.state == "PLANNING"){

            let message = {
                "type":"PlayerPlan",
                "action": actionInfo["action"],
                "angle": actionInfo["angle"]
            }
            this.state = "PLANNED";
            this.send(message)
            
        }
    }

    processMessage(message){
        super.processMessage(message);
        switch(message.type){
            case "ExecutePlans":
                this.executePlan(message);
                break;
            case "ExecutionFinished":
                if(message.gameOver){
                    this.finishGame();
                }else{
                    this.startPlanning();
                }

        }
    }

    executePlan(message){
        if (this.state == "PLANNED"){
            for (const plan of message.plans){
                switch(plan.action){
                    case "Fire":
                        this.game.shipFiresMissile(this.players[plan.player], plan.angle);
                        break;
                    case "Shield":
                        this.game.shipUsesShield(this.players[plan.player])
                        break;
                }
            }
            this.runSimulation();
        }
    }

    cleanUp(){
        super.cleanUp();
        this.mainDiv.classList.add("hidden");
        //TODO tidy up game!
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
        super.processMessage(message);
        switch(message.type){
            case "RoomInfo":
                this.processRoomInfo(message)
                break;
            case "StartGame":
                this.startGame(message);
                break;
        }
    }

    startGame(startMessage){
        let game = new Game(this.websocket, this.stateChangeCallback, startMessage);
        this.stateChangeCallback(game);
    }

    isHost(){
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