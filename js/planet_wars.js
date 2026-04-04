"use strict";

import {World} from './world.js'
import {WorldRenderer, Viewport} from './render.js'
import {Vector} from './geometry.js'

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

console.log(seed)

let world = new World(6, seed, 500)
let renderer = new WorldRenderer(seed)

let zoom = 400/world.radius
renderer.addBackgroundViewport(new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars0").getContext("2d"), 800, 800))
let missileTrailsViewPort = new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars1").getContext("2d"), 800, 800);
let missileViewPort = new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars2").getContext("2d"), 800, 800);
renderer.addLiveViewport(missileViewPort);
renderer.addTrailsViewport(missileTrailsViewPort)

renderer.renderBackground(world)


// world.fireMissile(0, new Vector(-10,-10)); 


function clickEvent(e) {
      // e = Mouse click event.
    let rect = e.target.getBoundingClientRect();
    let x = e.clientX - rect.left; //x position within the element.
    let y = e.clientY - rect.top;  //y position within the element.
    // console.log("Left? : " + x + " ; Top? : " + y + ".");
    let worldPos = missileViewPort.translateFromPixelToWorld(new Vector(x,y));

    for(const ship of world.ships){
        let velocity = worldPos.subtract(ship.position).unit().multiply(world.maxMissileSpeed);
        world.fireMissile(ship.playerIndex, velocity);
    }
    }

//https://stackoverflow.com/a/42111623
document.getElementById('planet_wars2').onclick = clickEvent;


let delay_ms = 10;

let physicsSteps = 10;

function update(){
    for(let i =0; i<physicsSteps;i++){
        world.physics.update((1/physicsSteps)*delay_ms/1000, i==0);
    }
    renderer.renderLive(world);
    renderer.renderTrails(world);
}

setInterval(update.bind(world.physics), delay_ms);

