
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
}

export function polar(angle, radius){
    return new Vector(Math.cos(angle)*radius, Math.sin(angle)*radius)
}