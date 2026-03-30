"use strict";

import { SeededRandom, Vector, polar } from "./geometry.js";

/***
 * 
 */
class Entity{
    constructor(position) {
        this.position = position;
    }
}

class PlayerShip extends Entity{
    colours = [
        "rgb(255,0,0)",
        "rgb(0,255,0)",
        "rgb(0,0,255)",
        "rgb(255,255,0)",
        "rgb(255,127,0)",
        

    ]
    constructor(position, playerIndex, radius){
        super(position);
        this.playerIndex = playerIndex;
        this.radius = radius;
        this.rgb = this.colours[playerIndex];
    }
}

class Planet extends Entity{
    constructor(position, density, radius, colour, ring=false, angle=0){
        super(position);
        this.density = density;
        this.radius = radius;
        this.colour = colour;
        this.ring = ring;
        this.angle = angle;
    }
}

export class World{
    /***
     * Holds the state of the world and will interact with the physics engine to run a single match
     */
    constructor(players, seed, radius=400, shipRadius=10, missileRadius=1, blackHoleRadius=5, planetMinR=35, planetMaxR=50){
        
        this.playerCount = players;
        this.random = new SeededRandom(seed);
        
        // simulated size, not necessarily display size
        this.radius = radius;
        this.shipRadius = shipRadius;
        this.missileRadius = missileRadius;
        this.blackHoleRadius = blackHoleRadius;

        this.spawnRadius = this.random.nextBetween(radius*0.75, radius*0.9);
        
        this.planetMinR = planetMinR;
        this.planetMaxR = planetMaxR;

        // one array of all entities or lots of lists of the different types?
        this.entities = [];
        this.ships = [];
        this.planets = [];
        
        this.generateMap();

    }


    generateMap(){
        this.ships = this.generateShips();
        this.planets = this.generatePlanets();
    }

    generateShips(){
        let offsetAngle = this.random.next()*Math.PI*2;
        let ships = []
        for(let i=0; i< this.playerCount; i++){
            ships.push(new PlayerShip(polar(i*Math.PI*2/this.playerCount + offsetAngle, this.spawnRadius), i, this.shipRadius));
        }
        return ships;
    }

    generatePlanets(){
        //plonk a planet roughly between each consequtive player, and then one in the middle of all of them
        let planets = [];

        let toPlonk = this.playerCount;
        if (this.playerCount == 2){
            toPlonk = 1;
        }

        for(let playerIndex =0; playerIndex< toPlonk ; playerIndex++){
            let nextPlayerIndex = (playerIndex+1)%this.playerCount;
            let betweenPlayers = this.ships[playerIndex].position.average(this.ships[nextPlayerIndex].position)
            planets = planets.concat(this.plonkPlanet(betweenPlayers, this.planetMinR, this.planetMaxR, 1));
        }
        return planets;
    }

    plonkPlanet = function(roughPosition, minR, maxR, wibble)
    {
        let midR = (minR + maxR) / 2;
        
        // let postion = roughPosition.add(new Vector(this.random.nextBetween(-midR, midR), this.random.nextBetween(-midR, midR)))
        //this.random.nextBetween(-midR, midR)//

        let x = this.random.next() * midR * 2 * wibble - midR * 1 * wibble;
        
        let y = this.random.next() * midR * 2 * wibble - midR * 1 * wibble;

        let planetPosition = roughPosition.add(new Vector(x,y));
        
        let planetRadius = this.random.nextBetween(minR, maxR);//roundNumber(minR + Math.round(Math.random() * (maxR - minR)));
        
        // //this can't override planet pos if wibble==0 (stops planets getting to close to ship, hopefully)
        // if (wibble > 0 && y - planetRadius < 0) 
        // {
        //     y = planetRadius * 2;
        // }
        // else if (wibble > 0 && y + planetRadius > planet_wars.worldHeight) 
        // {
        //     y = planet_wars.worldHeight - planetRadius * 2;
        // }
        
        // if (wibble > 0 && x - planetRadius < 0) 
        // {
        //     x = planetRadius * 2;
        // }
        // else if (wibble > 0 && x + planetRadius > planet_wars.worldWidth) 
        // {
        //     x = planet_wars.worldHeight - planetRadius * 2;
        // }
        let density = 1;
        let colour = "rgb(0 128 0)";//"008000";
        switch (Math.floor(this.random.next()*3))
        {
            case 0://low density - green
                density = 0.5;
                colour = "rgb(0 128 0)";
                break;
            case 1://normal density - brown
                density = 1.0;
                colour = "rgb(165 80 42)";//"A5502A";
                break;
            case 2://high density - blue
                density = 2.0;
                colour = "rgb(0 0 200)";//"0000C8";
                break;
        }
        
        // x = roundNumber(x);
        // y = roundNumber(y);
        
        if (!this.planetOverlaps(planetPosition, planetRadius))// && Detect.farFromRings([x,y],tempR))
        {
            let angle = this.random.next()* Math.PI*2;
            
            //0.1 ish chance of ring
            // new planet_wars.planet([x, y], planetRadius, tempD, tempC, (Math.random() < 0.1) ? true : false, tempAngle)
            let ring = this.random.next() < 0.1;
            let planet = new Planet(planetPosition, density, planetRadius, colour, ring, angle)
            return [planet];
            // return true;
        }
        return [];
    }


    planetOverlaps(testPosition, testRadius){
        for(const planet of this.planets){
            if (testPosition.subtract(planet.position).magnituteSquared() < Math.pow(testRadius + planet.radius, 2)){
                return true;
            }
        }
        return false;
    }
}