"use strict";

import {World} from './world.js'
import {WorldRenderer, Viewport} from './render.js'
import {Vector} from './geometry.js'
import { PlanetWarsMatch, Player } from './game.js';

/**
 
quick reproduction of turn-taking planet wars offline
 
 */

let params = new URLSearchParams(document.location.search);

let seed = params.get("seed");
if(seed == null){
    seed = Math.round(Math.random()*10000);
}

let playerCount = params.get("players");
if(playerCount == null){
    playerCount = 2;
}

console.log(seed)



let players = [];
for (let i =0; i<playerCount;i++){
    let player = new Player(i,`Player ${i}`, 0);
    players.push(player);

}

let game = new PlanetWarsMatch(document.getElementById("planet_wars_game"), players)

game.newRound(seed);

game.provideActionTypeChoice(players[0]);

let currentPlayer = 0;

game.setPlayerChosenActionCallback((info)=> {
    game.shipLosesTemporaryEffects(players[currentPlayer]);

    if (info["action"] == "Fire"){
        game.shipFiresMissile(players[currentPlayer], info["angle"]);
    }
    if (info["action"] == "Shield"){
        game.shipUsesShield(players[currentPlayer]);
    }
    
    game.runSimulation();
})

game.setSimulationFinishedCallback(() =>{
    
    if (!game.isGameOver()){
        do{
            currentPlayer++;
            currentPlayer%=game.players.length;
        }while(!players[currentPlayer].isAlive())
        game.provideActionTypeChoice(players[currentPlayer]);
    }else{
        //TODO
    }
})
