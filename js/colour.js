export class Colour{
    constructor(red, green, blue){
        this.red=red;
        this.green=green;
        this.blue = blue;
    }

    toString(alpha=1.0){
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${alpha})`
    }
}