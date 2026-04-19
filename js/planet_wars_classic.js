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

let info_blurb = document.getElementById("info_blurb");

let players = [];
for (let i =0; i<playerCount;i++){
    let player = new Player(i,`Player ${i}`, 0);
    players.push(player);

}

let game = new PlanetWarsMatch(document.getElementById("planet_wars_game"), players)

game.newRound(seed);


function startOfPlayersTurn(player){
    game.provideActionTypeChoice(player);
    info_blurb.innerHTML = `Player ${player.index}'s turn`
    info_blurb.style.color=player.ship.colour.toString();
}

let currentPlayer = Math.floor(Math.random()*players.length);

startOfPlayersTurn(players[currentPlayer]);



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

game.addEventListener("simulationFinished", (finishedInfo) =>{
    
    if (!finishedInfo["gameOver"]){
        do{
            currentPlayer++;
            currentPlayer%=players.length;
        }while(!players[currentPlayer].isAlive())
        startOfPlayersTurn(players[currentPlayer]);
    }else{
        //TODO
        let survivors = finishedInfo["survivors"];
        if(survivors.length > 0){
            info_blurb.innerHTML = `Player ${survivors[0]} wins`
            info_blurb.style.color=players[survivors[0]].ship.colour.toString();
        }else{
            // on second thoughts, this can't actually happen when you take turns
            info_blurb.style.removeProperty("color");
            info_blurb.innerHTML="Nobody wins";
        }
    }
})
