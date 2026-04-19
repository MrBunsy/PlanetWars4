export class Colour{
    constructor(red, green, blue){
        this.red=red;
        this.green=green;
        this.blue = blue;
    }

    toString(alpha=1.0){
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${alpha})`
    }

    /**
     * Return a new colour which is dimmer or brighter. 
     * @param {*} brightness < 1 for darker, >1 for brighter
     */
    adjustBrightness(brightness){
        return new Colour(this.trim(this.red*brightness), this.trim(this.green*brightness), this.trim(this.blue*brightness));
    }

    trim(rgb){
        let trimmed = Math.round(rgb);
        if (trimmed <0){
            trimmed = 0;
        }
        if (trimmed > 255){
            trimmed = 255;
        }
        return trimmed;
    }
}