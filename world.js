"use strict";

/***
 * 
 */
class Entity{

}

export class World{
    /***
     * Holds the state of the world and will interact with the physics engine to run a single match
     */
    constructor(players, seed, radius=800, ship_radius=10, missile_radius=1, black_hole_radius=5){
        
        this.players = players;
        this.seed = seed;
        if (this.seed == undefined){
            this.seed = Math.random();
        }
        
        // simulated size, not necessarily display size
        this.radius = radius;
        this.ship_radius = ship_radius;
        this.missile_radius = missile_radius;
        this.black_hole_radius = black_hole_radius;

        this.entities = []
        

    }
}