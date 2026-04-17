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
    let player = new Player(i,`Player ${i}`);
    // player.setShip(world.ships[i]);
    players.push(player);

}


// let world = new World(playerCount, seed, 500, 30, 80);



let game = new PlanetWarsMatch(document.getElementById("planet_wars_game"), players)

game.newRound(seed);

game.planMove(players[0]);

let currentPlayer = 0;

game.setPlayerFireMissileCallback((info)=> {
    game.shipFiresMissile(players[currentPlayer], info["angle"]);
    
    // game.planMove(players[currentPlayer]);
    game.runSimulation();
})

game.setSimulationFinishedCallback(() =>{
    
    if (!game.isGameOver()){
        do{
            currentPlayer++;
            currentPlayer%=game.players.length;
        }while(!players[currentPlayer].isAlive())
        game.planMove(players[currentPlayer]);
    }else{
        //TODO
    }
})
