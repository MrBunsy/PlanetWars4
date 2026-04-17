"use strict";

import {World} from './world.js'
import {WorldRenderer, Viewport} from './render.js'
import {Vector} from './geometry.js'
import { PlanetWarsMatch, Player } from './game.js';

/**
 * 
 * vague overall plan: a World will hold a physics engine object to simulate
 * 
 * a Match will be a higher level object which can run multiple rounds. each roudn will have its own World
 * 
 * a Renderer will render a world.
 * 
 * TODO exactly how renderer and match will interact for firing missiles
 * 
 */

let seed = Math.round(Math.random()*10000);//3;//11;

// seed = 2241;
// seed = 8655;
// seed = 4111;
// seed = 2216;
// seed = 5532;
// seed = 2;
seed = 983;
console.log(seed)

let playerCount = 3;

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
    }
})
