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

class BlackHole extends Entity{
    constructor(position, mass = 30000){
        super(position);
        this.mass = mass;
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

        this.spawnRadius = this.random.nextBetween(radius*0.8, radius*0.95);
        
        this.planetMinR = planetMinR;
        this.planetMaxR = planetMaxR;

        // one array of all entities or lots of lists of the different types?
        this.entities = [];
        this.ships = [];
        this.planets = [];
        
        this.generateMap();

    }


    generateMap(){
        this.generateShips();
        this.generatePlanets(this.playerCount + 3);
        this.generateBlackholes();
    }

    generateShips(){
        let offsetAngle = this.random.next()*Math.PI*2;
        this.ships = []
        for(let i=0; i< this.playerCount; i++){
            this.ships.push(new PlayerShip(polar(i*Math.PI*2/this.playerCount + offsetAngle, this.spawnRadius), i, this.shipRadius));
        }
    }

    generatePlanets(planetCountAim){
        //plonk a planet roughly between each consequtive player, and then one in the middle of all of them

        this.planets = [];

        let toPlonk = this.playerCount;
        if (this.playerCount == 2){
            toPlonk = 1;
        }

        for(let playerIndex =0; playerIndex< toPlonk ; playerIndex++){
            let nextPlayerIndex = (playerIndex+1)%this.playerCount;
            let betweenPlayers = this.ships[playerIndex].position.average(this.ships[nextPlayerIndex].position)
            this.planets=this.planets.concat(this.plonkPlanet(betweenPlayers, 1));
        }


        if (this.playerCount > 2) 
        {
            
            if (this.random.next() < 0.9) 
            {
                this.planets=this.planets.concat(this.plonkPlanet(new Vector(0,0), 2));
            }
        }

        let loopLimit = 0;

        while(this.planets.length < planetCountAim && loopLimit < 50){
            loopLimit++;
            this.planets=this.planets.concat(this.plonkPlanet(polar(this.random.next()*Math.PI*2, this.radius - this.planetMaxR*1.5), 0.5,));
        }


        


    }

    generateBlackholes(blackholeCountAim=1){
        this.blackholes = [];
        let loopLimit = 0;
        
        while (this.blackholes.length < blackholeCountAim && loopLimit < 50) 
        {
            let randomPosition = polar(this.random.next()*Math.PI*2, this.radius*this.random.next());
            
            if (!this.objectOverlaps(randomPosition, 50, 0.5, 20)) 
            {
                //far from ships and quite far from other planets
                this.blackholes.push(new BlackHole(randomPosition));
            }
            loopLimit++;
        }

    }

    /**
     * Roughly position a planet, with wibble*radius variation
     * @param {} roughPosition Vector
     * @param {*} wibble 
     * @param {*} existingPlanets array of planets placed so far, to avoid collisions
     * @returns 
     */
    plonkPlanet = function(roughPosition, wibble)
    {
        let midR = (this.planetMinR + this.planetMaxR) / 2;
        
        // let postion = roughPosition.add(new Vector(this.random.nextBetween(-midR, midR), this.random.nextBetween(-midR, midR)))
        //this.random.nextBetween(-midR, midR)//

        let x = this.random.next() * midR * 2 * wibble - midR * 1 * wibble;
        
        let y = this.random.next() * midR * 2 * wibble - midR * 1 * wibble;

        let planetPosition = roughPosition.add(new Vector(x,y));
        
        let planetRadius = this.random.nextBetween(this.planetMinR, this.planetMaxR);//roundNumber(minR + Math.round(Math.random() * (maxR - minR)));
        
        //TODO should colour be here or purely in the renderer? probably doesn't matter much at this complexity
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
        
        if (!this.objectOverlaps(planetPosition, planetRadius))// && Detect.farFromRings([x,y],tempR))
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


    objectOverlaps(testPosition, testRadius, minPlanetMultiplier=1/4, minShipMultiplier=15){
        for(const planet of this.planets){
            if (testPosition.subtract(planet.position).magnituteSquared() < Math.pow(testRadius + planet.radius + (testRadius + planet.radius)*minPlanetMultiplier, 2)){
                return true;
            }
        }
        for(const ship of this.ships){
            if(testPosition.subtract(ship.position).magnituteSquared() < Math.pow(testRadius + ship.radius*minShipMultiplier, 2)){
                return true;
            }
        }
        return false;
    }

    nearestBlackhole(testPosition, maxDistance){
        for(const blackhole of this.blackholes){
            if(testPosition.subtract(blackhole.position).magnituteSquared() < Math.pow(maxDistance, 2)){
                return blackhole;
            }
        }
        return null;
    }
}