
export class Vector{
    constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
    }

    add(b){
        return new Vector(this.x + b.x, this.y + b.y)
    }

    subtract(b){
        return new Vector(this.x - b.x, this.y - b.y)
    }
    
    multiply(scalar){
        return new Vector(this.x*scalar, this.y*scalar)
    }

    magnituteSquared(){
        return this.x*this.x + this.y*this.y;
    }

    average(b){
        return this.add(b).multiply(1/2);
    }
}

export function polar(angle, radius){
    return new Vector(Math.cos(angle)*radius, Math.sin(angle)*radius)
}

/**
 * Copied from old planet wars, from code mostly written by Ant from our uni course
 */
export class SeededRandom{
    constructor(seed)
    {
        this.seed = (typeof seed == 'undefined') ? randomInt() : seed;
    }

    next()
    {
        let rand_max = 65536; //2 bytes
        let rand = 0; //where the put the bits
        for (let i=0; i<16; i++)
        { 
            //get the random no, bit by bit, for 2 bytes
            this.seed = this.getBit(this.seed);
            //make space
            rand <<= 1;
            //add the new bit to the end
            rand |= (this.seed & 1);
        }
        return rand / (rand_max+1); //and down to 0-0.999999
    }

    nextBetween(min, max){
        return min + this.next()*(max-min);
    }

    getBit(bitSeed)
    {   
        if (bitSeed & 131072)
            bitSeed = ((bitSeed ^ 19) << 1) | 1;
        else
            bitSeed <<= 1;
        return bitSeed;
    }
}


function randomInt()
{
    return Math.round(Math.random()*65536);
}