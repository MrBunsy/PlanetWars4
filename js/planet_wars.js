"use strict";

import {World} from './world.js'
import {WorldRenderer, Viewport} from './render.js'
import {Vector} from './geometry.js'
import { PlanetWarsSocketClient } from './multiplayer.js';
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
 * update: I think world and renderer should be wrapped up in a PlanetWarsMatch object. The PlanetWarsMatch object will interact with the UI
 * and be owned by the PlanetWarsSocketClient.
 * 
 */


// world.fireMissile(0, new Vector(-10,-10)); 
let socket = new WebSocket("/ws");

let lobby = new PlanetWarsSocketClient(socket, (newStateObject) =>{
    //um, I'm not sure why I created this callback now.
    console.log("state changed")
}
);
