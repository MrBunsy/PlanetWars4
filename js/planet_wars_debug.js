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
// two player seed: 433807
// seed = 2241;
// seed = 8655;
// seed = 4111;
// seed = 2216;
// seed = 5532;
// seed = 2;
seed = 983;
console.log(seed)

let playerCount = 6;

let players = [];
for (let i =0; i<playerCount;i++){
    let player = new Player(i,`Player ${i}`);
    // player.setShip(world.ships[i]);
    players.push(player);

}


// let world = new World(playerCount, seed, 500, 30, 80);



let game = new PlanetWarsMatch(document.getElementById("planet_wars_game"), players)

game.newRound(seed);

game.provideActionTypeChoice(players[0]);

let currentPlayer = 0;

game.addEventListener("actionChosen", (info) => {
    game.shipLosesTemporaryEffects(players[currentPlayer]);
    if (info["action"] == "Fire"){
        game.shipFiresMissile(players[currentPlayer], info["angle"]);
    }
    if (info["action"] == "Shield"){
        game.shipUsesShield(players[currentPlayer]);
    }
    
    // game.planMove(players[currentPlayer]);
    game.runSimulation();
})

game.addEventListener("simulationFinished", (finishedInfo) =>{
    currentPlayer++;
    currentPlayer%=game.players.length;
    game.provideActionTypeChoice(players[currentPlayer]);
})


/* trying to see if the maximum height achievable according to physics is correct
https://en.wikipedia.org/wiki/Escape_velocity#Height_of_lower-velocity_trajectories
It appears to be roughly 1/3 of the actual height achievable when the planets are aproximately central
it makes sense there's error when the mass is unevenly distrubted, but I can't work out where the factor of 3
comes from

changed how I calculate new velocity (was difference in positions/time, is now old velocity + acceleration*timestep)
and now it's much much closer to expected.
playing aroudn with timesteps changes it slightly, so I think this is innacuracies in my physics engine?
*/
let multiple = 1;//.5;
const centreOfMass = game.world.physics.getCentreOfMass();
const viewport = game.renderer.liveViewports[0];//missileTrailsViewPort;
for(const ship of game.world.ships){
    let pos = ship.position;
    let x = game.world.maxMissileSpeed/game.world.physics.getEscapeVelocity(pos);
    let R = centreOfMass.subtract(pos).magnitude();
    let maxHeight = R*x*x/(1-x*x) * multiple;
    let centrePixels = viewport.translate(pos);
    viewport.canvas.beginPath();
    viewport.canvas.strokeStyle = "rgb(255,255,255)";
    viewport.canvas.arc(centrePixels.x, centrePixels.y , maxHeight*viewport.zoom , 0 , Math.PI*2 , true);
    viewport.canvas.stroke();

    // this at least roughly agrees with the above, suggesting it's not a bad approximation. but still has the multiple of 3 off
    // let startingEnergy = 0.5*1*world.maxMissileSpeed*world.maxMissileSpeed;
    // let startingPotential = world.physics.getGravitationalPotential(pos);// + startingEnergy;
    // let outDirection = pos.subtract(centreOfMass).unit();
    // let foundDistance = -1;
    // for(let distance = 0; distance < 500; distance++){
    //     let testPos = pos.add(outDirection.multiply(distance))
    //     let potential = world.physics.getGravitationalPotential(testPos)
    //     if (startingEnergy + startingPotential < potential){
    //         foundDistance = distance*multiple;
    //         break;
    //     }
    // }
    let foundDistance = game.world.physics.getEscapeDistanceForMissile(ship, game.world.maxMissileSpeed)*1.5;
    if (foundDistance > 0){
        viewport.canvas.beginPath();
        viewport.canvas.strokeStyle = "rgb(255,255,0)";
        viewport.canvas.arc(centrePixels.x, centrePixels.y , foundDistance*viewport.zoom , 0 , Math.PI*2 , true);
        viewport.canvas.stroke();
    }

}



// let x = world.maxMissileSpeed/world.physics.getEscapeVelocity(world.ships[0].position);
// let R = world.physics.getCentreOfMass().subtract(world.ships[0].position).magnitude();
// let centre = missileTrailsViewPort.translate(world.physics.getCentreOfMass());
// let maxHeight = R*x*x/(1-x*x);
// maxHeight *= 3
// centre = missileTrailsViewPort.translate(world.ships[0].position)
// // maxHeight +=  R;
// missileTrailsViewPort.canvas.beginPath();
// missileTrailsViewPort.canvas.strokeStyle = "rgb(255,255,255)";
// missileTrailsViewPort.canvas.arc(centre.x, centre.y , maxHeight*missileTrailsViewPort.zoom , 0 , Math.PI*2 , true);
// missileTrailsViewPort.canvas.stroke();

// socket.addEventListener("open", (event) => {
//   socket.send("Hello Server!");
// });

// socket.addEventListener("message", (event) => {
//   console.log("Message from server ", event.data);
//   let message = JSON.parse(event.data);
//   if(message.hasOwnProperty("fire")){
//     let fire = message["fire"];
//     if (fire.hasOwnProperty("velocity") && fire.hasOwnProperty("player")){
//         let velocity = new Vector().fromJSON(fire["velocity"])
//         world.fireMissile(fire["player"], velocity);
//     }
//   }
// });
