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
seed = 4111;

console.log(seed)

let world = new World(4, seed)
let renderer = new WorldRenderer(seed)

renderer.addViewport(new Viewport(new Vector(0,0), 1.0, document.getElementById("planet_wars0").getContext("2d"), 800, 800))

renderer.render(world)

