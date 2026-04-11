import {Vector, polar} from './geometry.js'


/**
 * Quick and simple, will copy lots of code from my old physics engine
 * 
 * not general purpose - just support for:
 * - circle collisions
 * - square collisions (for crates) - can I get away without this to make things more simple?,
 * - runga cutta integration
 * - gravity between objects with mass
 */

/**
 * Only need to suport circles with mass
 */
export class PhysicsEntity{
    constructor(physics, radius, mass, position, immobile=False, velocity=new Vector(0,0)){
        this.physics = physics
        this.radius = radius;
        this.mass = mass;
        this.immobile = immobile;
        this.position = position;
        this.velocity = velocity;

        //back to the World object this is for
        // this.reference = reference;

        this.newPosition = new Vector();
        this.oldPosition = position.copy();
        this.oldPositions = [];
    }

    collisionWith(otherEntity){
        //*shrug*
    }
}


export class PhysicsEngine{

    //completely made up. seems to work.
    G = 400;
    //F=-bV (drag), friction=b
    friction=0;//0.01;

    constructor() {
        this.entities = [];
    }

    eulerFindVelocity(velocity,acceleration,time)
    {
        //return speed aproximated by euler integration at time t
        return velocity.add(acceleration.multiply(time))
    }
    /**
     * 
     * @param {*} time_s 
     * @param {*} updateOldPosition if True then put oldPosition to the current position when updating (used to perform multiple physics steps that behave like one)
     */
    update(time_s, updateOldPosition=false){

        for(const entity of this.entities){
            if(entity.immobile){
                entity.newPosition = entity.position;
                continue
            }
            //runge kutta 4

            //calculate velocities at different positions
            // pos_n+1 = pos_n + velocity*time
            // the different ks are different velocities
            // dy/dt = f(t,y) 
			// Yn+1 = Yn + (1/6)*h*( K1 + 2K2 + 2K3 + K4 )
			// K1 = f(Tn,Yn)
			// K2 = f(Tn + 0.5h , Yn + 0.5*h*K1)
			// K3 = f(Tn + 0.5h , Yn + 0.5*h*K2)
			// K4 = f(Tn + h , Yn + hK3)

            // let k1_force = this.getGravityForces(entity, entity.position).add(this.getGravityForces(entity.velocity));
            // let k1_acceleration = k1_force.multiply(entity.mass);

            // let k1 = this.eulerFindVelocity(entity.velocity, k1_acceleration, time_s);

            // let k1 = this.eulerFindVelocity(entity.velocity, this.getAccelerationForEntity(entity, entity.velocity, entity.position), time_s);

            // let k2_position = entity.position.add(k1.multiply(time_s/2));
            // let k2_acceleration = this.getAccelerationForEntity(entity, k1, k2_position);
            // let k2 = this.eulerFindVelocity()

            
            // let new_position = entity.position.add(k1.add())



            //urgh, sod it. just euler for now and decrease time step. I'm not sure i actually had runge kutta working properly previously anyway
            let acceleration = this.getAccelerationForEntity(entity, entity.velocity, entity.position);
            // keep position same for this loop so we don't affect calculations of other entities
            entity.newPosition = this.eulerIntegration(entity.position, entity.velocity, acceleration, time_s);
            // entity.velocity = entity.newPosition.subtract(entity.position).multiply(1/time_s);
            entity.velocity = entity.velocity.add(acceleration.multiply(time_s));
        }

        for(let entityIndex=0; entityIndex < this.entities.length; entityIndex++){
            
            let entity = this.entities[entityIndex];

            for(let otherEntityIndex=entityIndex+1; otherEntityIndex <this.entities.length; otherEntityIndex++){
                let otherEntity = this.entities[otherEntityIndex];
                if(entity.newPosition.subtract(otherEntity.newPosition).magnitudeSquared() < Math.pow(entity.radius + otherEntity.radius, 2)){
                    // collision!
                    this.collision(entity, otherEntity);
                }
            }

            if (!entity.immobile && updateOldPosition){
                
                entity.oldPositions = [entity.position.copy()];
            }
            entity.oldPosition = entity.position.copy();
            entity.oldPositions.push(entity.newPosition.copy());
            entity.position = entity.newPosition;
            // }
        }

    }

    collision(entityA, entityB){
        entityA.collisionWith(entityB);
        entityB.collisionWith(entityA)
    }

    eulerIntegration=function(position,velocity,acceleration,time)
    {
        //x=vt + 0.5at^2
        // position+=velocity*time + 0.5*acceleration*time*time;
        return position.add(velocity.multiply(time).add(acceleration.multiply(0.5*time*time)))
    }

    getAccelerationForEntity(entity, velocity, position){
        let force = this.getGravityForces(entity, position).add(this.getFrictionForces(velocity));
        let acceleration = force.multiply(entity.mass);
        return acceleration;
    }

    addEntity(entity){
        this.entities.push(entity);
    }

    addEntities(entities){
        this.entities = this.entities.concat(entities)
    }

    removeEntity(entity){
        const index = this.entities.indexOf(entity);
        this.entities.splice(index,1);
    }

    /**
     * Given a ship, work out how far "out" a missile can go from the centre of the map
     * Aproximately correct. Slightly underestimates. Multiplying by 1.5 appears to be roughly right.
     * I assume this is innacuraies in the physics engine
     * 
     * Bit more accurate than just calculating theoretical maximum height from a single sphere
     * @param {*} ship 
     */
    getEscapeDistanceForMissile(ship, maxMissileSpeed, maxDistance=1000, missileMass=1){
        const pos = ship.position;
        // const centreOfMass = this.getCentreOfMass();
        // actually try from centre of map I think
        const centreOfMap = new Vector(0,0)
        const startingEnergy = 0.5*missileMass*Math.pow(maxMissileSpeed, 2);
        const startingPotential = this.getGravitationalPotential(pos);
        const outDirection = pos.subtract(centreOfMap).unit();
        for(let distance = 0; distance < maxDistance; distance++){
            let testPos = pos.add(outDirection.multiply(distance))
            let potential = this.getGravitationalPotential(testPos)
            if (startingEnergy + startingPotential < potential){
                return distance;
                break;
            }
        }
        //escaped, or least can get further than the test
        return -1;
    }

    /**
     * Really getting electric potential as that was what was modelled before
     * multiply this by the mass of the object at position and it is real gravitational potential energy
     * @param {*} position 
     */
    getGravitationalPotential(position){
        let potential=0;
        
        for (const entity of this.entities)
        {
            let r=position.subtract(entity.position).magnitude()
            if (r!=0){
                //find the electric potential at a point
                potential+=-this.G * entity.mass / r;
            }
            
        }
        
        return potential;
    }
    /**
     * 
     * @param {*} entity 
     * @returns force on an entity from gravity of all the other entities mass
     */
    getGravityForces(entity, entityPos)
    {
        let force=new Vector(0,0);
        if(entity.mass > 0)
        {
            for(const otherEntity of this.entities)
            {
                if(!Object.is(entity, otherEntity))
                {
                    let rsqrd=entityPos.subtract(otherEntity.position).magnitudeSquared();
                    if (rsqrd == 0){
                        //just in case
                        continue;
                    }
                    //coloumbs law:
                    //f=k.q1.q2/r^2
                    //or gravity:
                    //f=G*m1*m2/r**2
                    let gravityForce=this.G*otherEntity.mass*entity.mass/rsqrd;
                    // let gravityAngle=Math.atan2(entityPos.y-otherEntity.position.y,entityPos.x-otherEntity.position.x);
                    // with two positive masses this will pull the objects together
                    let gravityDirection=otherEntity.position.subtract(entityPos).unit()
                    force = force.add(gravityDirection.multiply(gravityForce));
                }
            }
        }
        return force;
    }

    getFrictionForces(velocity)
    {    
        return velocity.multiply(-this.friction)
    }

    getTotalMass(){
        let totalMass = 0;
        for(const entity of this.entities){
            totalMass += entity.mass;
        }
        return totalMass;
    }

    getEscapeVelocity(atPosition){
        let totalMass = this.getTotalMass();
        let centreOfMass = this.getCentreOfMass();
        let distance = atPosition.subtract(centreOfMass).magnitude();
        //treating the whole world as a single mass 
        let v = Math.sqrt(2*this.G*totalMass/distance)
        return v;
    }

    getCentreOfMass(){
        // assuming I've read wikipedia correctly.
        let centre = new Vector(0,0)
        let totalMass = 0;
        for(const entity of this.entities){
            centre = centre.add(entity.position.multiply(entity.mass))
            totalMass += entity.mass;
        }
        centre = centre.multiply(1/totalMass);
        return centre;
    }

    release(){
        //release all references so it should be garbage collected
        this.entities = null;
    }
}