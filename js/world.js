"use strict";

import { SeededRandom, Vector, polar } from "./geometry.js";
import { PhysicsEngine, PhysicsEntity } from "./physics.js";
import { Colour } from "./colour.js"

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
        // "rgb(255,0,0)",
        // "rgb(0,0,255)",
        // "rgb(255,255,0)",
        // "rgb(0,255,0)",       
        // "rgb(127,0,200)",
        // "rgb(255,127,0)",
        // "rgb(64, 224, 208)",
        // "rgb(255,127,255)",
        // "rgb(150, 75, 0)",
        new Colour(255,0,0),
        new Colour(0,0,255),
        new Colour(255,255,0),
        new Colour(0,255,0),       
        new Colour(127,0,200),
        new Colour(255,127,0),
        new Colour(64, 224, 208),
        new Colour(255,127,255),
        new Colour(150, 75, 0),

    ]
    constructor(world, position, playerIndex, radius){
        super(world.physics, radius, 0, position, true);
        this.world = world;
        this.playerIndex = playerIndex;
        // this.radius = radius;
        this.colour = this.colours[playerIndex];
        this.angle = this.position.angleTo(this.world.centre);
        this.alive = true;
        this.killedBy = null;
    }

    kill(byPlayer){
        this.alive = false;
        this.killedBy=byPlayer;
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
    constructor(world, radius, position, velocity, playerIndex){
        super(world.physics, radius, 1, position, false, velocity);
        this.world = world;
        this.playerIndex = playerIndex;
        this.ship = world.ships[playerIndex];
        this.colour = this.ship.colour;
    }

    collisionWith(otherEntity){
        if(otherEntity instanceof PlayerShip){
            otherEntity.kill(this.playerIndex);
        }
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
    constructor(players, seed, radius=400, maxRadius=-1, planetMinR=20, planetMaxR=50, shipRadius=10, missileRadius=1, blackHoleRadius=5, maxMissileSpeed=100){
        
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

        this.maxRadius = radius*1.5;
        if(maxRadius > 0){
            this.maxRadius = maxRadius;
        }

        this.physics = new PhysicsEngine(this.maxRadius);
        this.centre = new Vector(0,0);

        this.missiles = []
        
        this.generateMap();

    }

    fireMissile(playerIndex, velocity){
        let position = this.ships[playerIndex].position.add(velocity.unit().multiply(this.shipRadius + this.missileRadius + 1))
        let missile = new Missile(this, this.missileRadius,position, velocity, playerIndex);
        this.missiles.push(missile)
        this.physics.addEntity(missile)

    }
    fireMissileAtAngle(playerIndex, angle){
        this.fireMissile(playerIndex, polar(angle, this.maxMissileSpeed))
    }

    removeMissile(missile){
        const index = this.missiles.indexOf(missile);
        this.missiles.splice(index,1);
    }

    getLiveMissileCount(){
        return this.missiles.length;
    }

    getLivePlayerCount(){
        let count = 0;
        for(const ship of this.ships){
            if (ship.alive){
                count++;
            }
        }
        return count;
    }

    getLivePlayerIndexes(){
        let players = [];
        for(const ship of this.ships){
            if (ship.alive){
                players.push(ship.playerIndex)
            }
        }
        return players;
    }

    generateMap(){
        let attempts = 0;
        do{
            this.physics.release()
            this.physics = new PhysicsEngine(this.maxRadius);
            this.generateShips();
            this.generatePlanets(this.playerCount + 3);
            // this.generatePlanets(1);
            let blackholeCount = this.random.next() < 0.2 ? 1 : 0;
            this.generateBlackholes(blackholeCount);

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

        if (this.playerCount > 2) 
        {
            for(let playerIndex =0; playerIndex< toPlonk ; playerIndex++){
                let nextPlayerIndex = (playerIndex+1)%this.playerCount;
                let betweenPlayers = this.ships[playerIndex].position.average(this.ships[nextPlayerIndex].position);
                let towardsCentre = this.random.next()*this.radius*0.2;
                //bring towards the centre by a small amount
                betweenPlayers = betweenPlayers.add(new Vector(0,0).subtract(betweenPlayers).unit().multiply(towardsCentre));


                this.planets=this.planets.concat(this.plonkPlanet(betweenPlayers, 1));
            }
        }


        // if (this.playerCount > 2) 
        // {
            // one roughly in the centre
            if (this.random.next() < 0.9) 
            {
                this.planets=this.planets.concat(this.plonkPlanet(new Vector(0,0), 2));
            }
        // }

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
            if (testPosition.subtract(planet.position).magnitudeSquared() < Math.pow(testRadius + planet.radius + (testRadius + planet.radius)*minPlanetMultiplier, 2)){
                return true;
            }
        }
        for(const ship of this.ships){
            if(testPosition.subtract(ship.position).magnitudeSquared() < Math.pow(testRadius + ship.radius*minShipMultiplier, 2)){
                return true;
            }
        }
        return false;
    }

    nearestBlackhole(testPosition, maxDistance){
        for(const blackhole of this.blackholes){
            if(testPosition.subtract(blackhole.position).magnitudeSquared() < Math.pow(maxDistance, 2)){
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

        if (centreOfMass.magnitude > this.radius*0.15){
            //too uneven
            console.log(`Centre of mass too off centre: ${centreOfMass}`)
            return false;
        }

        let potentials = []

        // keep escape velocity in range. Not so low that we can escape the map massively, but not so high that the missile is just sucked into the centre
        // Experiments have shown that escape velocity isn't super accurate as representing all the planets as a single planet isn't quite right
        // could update to calculating potential over distance
        // it's good enough for an order-of-magnitude.
        for (const ship of this.ships) 
        {
            // let escapeVelocity = this.physics.getEscapeVelocity(ship.position);
            // // console.log("Escape velocity for ship " + ship.colour + " = "+escapeVelocity)
            // // if (escapeVelocity < this.maxMissileSpeed*1.25){
            // if (escapeVelocity < this.maxMissileSpeed*2){
            //     //don't want to be able to just go around the edge
            //     console.log(`Escape velocity too low for ship ${ship.colour} = ${escapeVelocity}`)
            //     this.planetMinR*=1.001
            //     this.planetMaxR*=1.001
            //     return false;
            // }
            // if (escapeVelocity > this.maxMissileSpeed*3.5){
            //     //don't want missiles to just be sucked into the centre
            //     console.log(`Escape velocity too high for ship ${ship.colour} = ${escapeVelocity}`)

            //     // idea - if struggling to make world possible, make planets smaller
            //     this.planetMinR*=0.999
            //     this.planetMaxR*=0.999

            //     return false;
            // }

            let maxMissileDistanceOutwards = this.physics.getEscapeDistanceForMissile(ship, this.maxMissileSpeed)
            if (maxMissileDistanceOutwards < 0 || maxMissileDistanceOutwards > this.radius*0.4){
                //can escape or go too far
                console.log(`Gravity too low for ship ${ship.colour} max distance = ${maxMissileDistanceOutwards} > ${this.radius*0.1}`)
                this.planetMinR*=1.001;
                this.planetMaxR*=1.001;
                return false;
            }
            if (maxMissileDistanceOutwards < this.radius*0.1){
                //too strong
                console.log(`Gravity too high for ship ${ship.colour} max distance = ${maxMissileDistanceOutwards} < ${this.radius*0.1}`)
                this.planetMinR*=0.999;
                this.planetMaxR*=0.999;
                return false;
            }



            potentials.push(this.physics.getGravitationalPotential(ship.position));
        }

        /* see if there's enough energy in a missile to actually reach all the other opponents. The physics engine is just about accurate
        enough for this is be aproximately correct (might be worth rk4 just to see if this can get better - see experiments with escape
        velocty in planet_wars_debug.js).
        Doesn't take into account paths.
        */
        for (let us = 0; us < potentials.length; us++) 
        {
            for (let them = 0; them < potentials.length; them++) 
            {
                if(us == them){
                    continue;
                }
                // console.log(`From ${us} to ${them} = ${potentials[them] - potentials[us]}`)
                //not multipling by mass because the potentials were and they will cancel out (plus mass of missile is hardcoded to 1)
                let missileKineticEnergy = 0.5*Math.pow(this.maxMissileSpeed,2);

                let maxDifference = missileKineticEnergy*0.5;
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