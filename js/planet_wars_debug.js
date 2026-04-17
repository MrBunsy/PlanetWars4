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

let playerCount = 2;

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

game.setPlayerFireMissileCallback((player, angle)=> {
    game.shipFiresMissile(player, angle);
    
    // game.planMove(players[currentPlayer]);
    game.runSimulation();
})

game.setSimulationFinishedCallback(() =>{
    currentPlayer++;
    currentPlayer%=game.players.length;
    game.planMove(players[currentPlayer]);
})

// let renderer = new WorldRenderer(seed);

// let zoom = 400/world.radius
// // zoom = 0.5;
// renderer.addBackgroundViewport(new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars0").getContext("2d"), 800, 800))
// let missileTrailsViewPort = new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars1").getContext("2d"), 800, 800);
// let missileViewPort = new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars2").getContext("2d"), 800, 800);
// renderer.addLiveViewport(missileViewPort);
// renderer.addTrailsViewport(missileTrailsViewPort)

// renderer.renderBackground(world)


// world.fireMissile(0, new Vector(-10,-10)); 
// let socket = new WebSocket("https://planetwars.lukewallin.co.uk/ws");


// function clickEventFire(e) {
//       // e = Mouse click event.
//     let rect = e.target.getBoundingClientRect();
//     let x = e.clientX - rect.left; //x position within the element.
//     let y = e.clientY - rect.top;  //y position within the element.
//     // console.log("Left? : " + x + " ; Top? : " + y + ".");
//     let worldPos = missileViewPort.translateFromPixelToWorld(new Vector(x,y));

//     for(const ship of game.world.ships){
//         let velocity = worldPos.subtract(ship.position).unit().multiply(world.maxMissileSpeed);
//         game.world.fireMissile(ship.playerIndex, velocity);

//         let test = {"fire": {"velocity":velocity, "player": ship.playerIndex}, }
//         // socket.send(JSON.stringify(test))
//     }
//     renderer.dimTrails();
//     }

// let oldAngles = []

// function clickEvent(e){
//     let rect = e.target.getBoundingClientRect();
//     let x = e.clientX - rect.left; //x position within the element.
//     let y = e.clientY - rect.top;  //y position within the element.
//     // console.log("Left? : " + x + " ; Top? : " + y + ".");
//     let worldPos = missileViewPort.translateFromPixelToWorld(new Vector(x,y));
//     const ship = world.ships[0]
//     const angle = ship.position.angleTo(worldPos);
//     // renderer.renderAimingRecepticle(missileTrailsViewPort, ship, angle, oldAngles)
//     oldAngles.unshift(angle);
// }
//https://stackoverflow.com/a/42111623
// document.getElementById('planet_wars2').onclick = clickEvent;

// //framerate
// let fps = 30;
// let delay_ms = 1000/fps;
// //smallest timestep we'll simulate. if I get runge kutta working, might be able to increase this to lower CPU usage
// let physicsSteps_ms = 5;

// //how fast to playback simulation. Want it slow enough to be fun to watch, but not so slow as to get boring
// let simulationSpeed = 0.4;
// // simulationSpeed = 2

// const start = performance.now();
// let lastUpdateTime = performance.now();

// function update(){
//     let now = performance.now();
//     let actualTimePassed_ms = now - lastUpdateTime;
//     lastUpdateTime = now;
//     // console.log(`Actual time passed: ${actualTimePassed_ms}ms`)
//     for(let i =0; i<Math.floor(actualTimePassed_ms/physicsSteps_ms);i++){
//         world.physics.update(simulationSpeed*physicsSteps_ms/1000, i==0);
//     }
//     renderer.renderLive(world);
//     renderer.renderTrails(world);
//     setTimeout(()=>update(), delay_ms)
// }

// // setInterval(update.bind(world.physics), delay_ms);
// setTimeout(()=>update(), delay_ms)

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
