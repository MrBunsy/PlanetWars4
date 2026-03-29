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
let world = new World()
let renderer = new WorldRenderer()

renderer.addViewport(new Viewport(new Vector(400,400), 1, document.getElementById("planet_wars0").getContext("2d")))

renderer.render()

