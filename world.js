"use strict";

import { SeededRandom, Vector, polar } from "./geometry.js";
import { PhysicsEngine, PhysicsEntity } from "./physics.js";

/***
 * 
 */
// class Entity extends PhysicsEntity{
//     constructor(radius, mass, position, immobile=False, velocity=Vector(0,0)) {
//         super(radius, mass, position, immobile, velocity)
//     }
// }

class PlayerShip extends PhysicsEntity{
    colours = [
        "rgb(255,0,0)",
        "rgb(0,0,255)",
        "rgb(255,255,0)",
        "rgb(0,255,0)",       
        "rgb(127,0,200)",
        "rgb(255,127,0)",
        "rgb(64, 224, 208)",
        "rgb(255,127,255)",
        "rgb(150, 75, 0)",
        

    ]
    constructor(world, position, playerIndex, radius){
        super(world.physics, radius, 0, position, true);
        this.world = world;
        this.playerIndex = playerIndex;
        // this.radius = radius;
        this.rgb = this.colours[playerIndex];
    }

//     fireMissile(physics, direction){
        
//     }
}

class Planet extends PhysicsEntity{
    constructor(world, position, density, radius, colour, ring=false, angle=0){
        let mass = 0.3 * Math.pow(radius, 3) * density;
        super(world.physics, radius, mass, position, true);
        this.world = world;
        this.density = density;
        this.radius = radius;
        this.colour = colour;
        this.ring = ring;
        this.angle = angle;
    }
}

class BlackHole extends PhysicsEntity{
    constructor(world, position, mass = 30000){
        super(world.physics, 10, mass, position, true);
        this.mass = mass;
    }
}

class Missile extends PhysicsEntity{
    constructor(world, radius, position, velocity, colour){
        super(world.physics, radius, 1, position, false, velocity);
        this.world = world;
        this.colour = colour;
    }

    collisionWith(otherEntity){
        // console.log("COLLISION")
        this.physics.removeEntity(this);
        this.physics = null;
        this.world.removeMissile(this)
    }
}

export class World{
    /***
     * Holds the state of the world and will interact with the physics engine to run a single match
     */
    constructor(players, seed, radius=400, shipRadius=10, missileRadius=1, blackHoleRadius=5, planetMinR=35, planetMaxR=50, maxMissileSpeed=400){
        
        this.playerCount = players;
        this.random = new SeededRandom(seed);
        
        // simulated size, not necessarily display size
        this.radius = radius;
        this.shipRadius = shipRadius;
        this.missileRadius = missileRadius;
        this.blackHoleRadius = blackHoleRadius;

        this.maxMissileSpeed=maxMissileSpeed;

        this.spawnRadius = this.random.nextBetween(radius*0.9, radius*0.95);
        
        this.planetMinR = planetMinR;
        this.planetMaxR = planetMaxR;

        // one array of all entities or lots of lists of the different types?
        this.entities = [];
        this.ships = [];
        this.planets = [];

        this.physics = new PhysicsEngine();

        this.missiles = []
        
        this.generateMap();

    }

    fireMissile(playerIndex, velocity){
        let position = this.ships[playerIndex].position.add(velocity.unit().multiply(this.shipRadius + this.missileRadius + 1))
        let missile = new Missile(this, this.missileRadius,position, velocity, this.ships[playerIndex].rgb);
        this.missiles.push(missile)
        this.physics.addEntity(missile)

    }

    removeMissile(missile){
        const index = this.missiles.indexOf(missile);
        this.missiles.splice(index,1);
    }

    generateMap(){
        let attempts = 0;
        do{
            this.physics.release()
            this.physics = new PhysicsEngine();
            this.generateShips();
            this.generatePlanets(this.playerCount + 3);
            this.generateBlackholes();

            this.physics.addEntities(this.ships);
            this.physics.addEntities(this.planets);
            this.physics.addEntities(this.blackholes);
            attempts++;
            console.log("generateMap attempt " + attempts)
        }while(!this.checkMapPossible() && attempts < 1000)
    }

    generateShips(){
        let offsetAngle = this.random.next()*Math.PI*2;
        this.ships = []
        for(let i=0; i< this.playerCount; i++){
            this.ships.push(new PlayerShip(this, polar(i*Math.PI*2/this.playerCount + offsetAngle, this.spawnRadius), i, this.shipRadius));
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
                this.blackholes.push(new BlackHole(this, randomPosition));
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
            let planet = new Planet(this, planetPosition, density, planetRadius, colour, ring, angle)
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

    checkMapPossible()
    {
        /*
        New plan: I should be able to work out the maximum "gravitational difference" that can be overcome - I know
        the mass and max initial speed of the missile, so I know it's kinetic energy.

        other idea - check centre of mass of everything is aproximately central to make it fair

        maybe a limit on maximum mass? I want to be able to fire missiles outwards
        */ 

        let centreOfMass = this.physics.getCentreOfMass();
        // console.log("Centre: " + centreOfMass)

        if (centreOfMass.magnitute > this.radius*0.15){
            //too uneven
            console.log(`Centre of mass too off centre: ${centreOfMass}`)
            return false;
        }

        let potentials = []

        for (const ship of this.ships) 
        {
            let escapeVelocity = this.physics.getEscapeVelocity(ship.position);
            // console.log("Escape velocity for ship " + ship.rgb + " = "+escapeVelocity)
            if (escapeVelocity < this.maxMissileSpeed*1.25){
                //don't want to be able to just go around the edge
                 console.log(`Escape velocity too low for ship ${ship.rgb} = ${escapeVelocity}`)
                return false;
            }
            if (escapeVelocity > this.maxMissileSpeed*2){
                //don't want missiles to just be sucked into the centre
                console.log(`Escape velocity too high for ship ${ship.rgb} = ${escapeVelocity}`)
                return false;
            }
            potentials.push(this.physics.getGravitationalPotential(ship.position));
        }




        // //ported from old planet wars when it was modelled as charge rather than gravity. now it's called gravity but it's all the same constants
        // let potentials = [];
        // //build up array of potentials at each ship
        // for (const ship of this.ships) 
        // {
        //     potentials.push(this.physics.getGravitationalPotential(ship.position));
        // }
        // //checking voltage between ships, if this is less than -160,000 it seems to be impossible to hit.
        // //TODO check still true with the slightly larger maps and slightly different masses
        for (let us = 0; us < potentials.length; us++) 
        {
            for (let them = 0; them < potentials.length; them++) 
            {
                if(us == them){
                    continue;
                }
                // console.log(`From ${us} to ${them} = ${potentials[them] - potentials[us]}`)
                //not multipling by mass because the potentials were and they will cancel out
                let missileKineticEnergy = 0.5*Math.pow(this.maxMissileSpeed,2);

                // I think I've got this -ve somehow, still thinking. some experiments have shown that a -ve value here doesn't result in a missile being
                // able to reach another ship
                // console.log(`kinetic energy/mass for missile = ${missileKineticEnergy}`)
                let maxDifference = missileKineticEnergy*0.2;
                if (potentials[them] - potentials[us] > maxDifference) 
                {
                    console.log(`From ${us} to ${them} = ${potentials[them] - potentials[us]} > ${maxDifference}`)
                    return false;
                }
            }
        }
        
        
        return true;
    }
}