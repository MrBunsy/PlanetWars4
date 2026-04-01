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

        this.newPosition = new Vector()
    }

    collisionWith(otherEntity){
        //*shrug*
    }
}


export class PhysicsEngine{

    // stealing constants from the old physics engine because it worked pretty well. Gravity was being modelled as coloumbs law
    // so this was k.
    G = 10;//8990000000;
    //F=-bV (drag), friction=b
    friction=5;

    constructor() {
        this.entities = [];
    }

    eulerFindVelocity(velocity,acceleration,time)
    {
        //return speed aproximated by euler integration at time t
        return velocity.add(acceleration.multiply(time))
    }

    update(time_s){

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



            //urgh, sod it. just euler for now and see if it's good enough or not. I'm not sure i actually had runge kutta working properly previously anyway
            let acceleration = this.getAccelerationForEntity(entity, entity.velocity, entity.position);
            // keep position same for this loop so we don't affect calculations of other entities
            entity.newPosition = this.eulerIntegration(entity.position, entity.velocity, acceleration, time_s);
        }

        for(let entityIndex=0; entityIndex < this.entities.length; entityIndex++){
            
            let entity = this.entities[entityIndex];

            for(let otherEntityIndex=entityIndex+1; otherEntityIndex <this.entities.length; otherEntityIndex++){
                let otherEntity = this.entities[otherEntityIndex];
                if(entity.newPosition.subtract(otherEntity.newPosition).magnituteSquared() < Math.pow(entity.radius + otherEntity.radius, 2)){
                    // collision!
                    this.collision(entity, otherEntity);
                }
            }
            if (!entity.immobile){
                entity.position = entity.newPosition;
            }
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
        let force = this.getGravityForces(entity, position).add(this.getGravityForces(velocity));
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
     * Really getting electric potential as that was what was modelled before
     * @param {*} position 
     */
    getGravitationalPotential(position){
        let potential=0;
        
        for (const entity of this.entities)
        {
            let r=position.subtract(entity.position).magnitute()
            if (r!=0){
                //find the electric potential at a point
                potential+=this.G * entity.mass / r;
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
                    let rsqrd=entityPos.subtract(otherEntity.position).magnituteSquared();
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

    release(){
        //release all references so it should be garbage collected
        this.entities = null;
    }
}