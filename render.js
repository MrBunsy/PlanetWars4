
import { Vector, polar } from "./geometry.js"

export class Viewport{
    constructor(centre, zoom, canvas, enabled = true){
        this.centre = centre;
        this.zoom = zoom;
        this.canvas = canvas;
        this.enabled = enabled;
    }

    translate(position){
        return position.add(this.centre.multiply(this.zoom));
    }
}

/**
 * The following things need rendering:
 * 
 *  - world, which is more or less static (planets, ships, stars)
 *  - trails, left behind by missiles. Might be worth fading older ones, so may be multiple layers here. Maybe latest, previous, then a background of all with transparency?
 *  - animations, redrawn every frame. 
 * 
 *  The plan is that teh world will be a circle. It will be constrained in CSS. Undecided if to render everything on a square and rely on nothing much being
 *  out of the circle, or to limit renderer to a circle?
 */
export class WorldRenderer{
    constructor(){
        this.viewports = [];
    }

    addViewport(viewport){
        this.viewports.push(viewport)
    }

    render(){
        for(const viewport of this.viewports){
            if(viewport.enabled){
                let centre = viewport.translate(new Vector(0,0));
                // viewport.canvas.beginPath();
                // // viewport.canvas.fillStyle = grad;
                // viewport.canvas.arc(centre.x, centre.y, 400, 0, Math.PI * 2, true);
                // viewport.canvas.fill();
                let topLeft = centre.add(new Vector(-400,-400).multiply(viewport.zoom));
                viewport.canvas.fillRect(topLeft.x, topLeft.y, 800*viewport.zoom, 800*viewport.zoom);
            }
        }
    }
}