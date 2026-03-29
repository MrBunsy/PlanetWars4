
import { Vector, polar, SeededRandom } from "./geometry.js"

export class Viewport{
    constructor(centre, zoom, canvas, width, height, enabled = true){
        this.centre = centre;
        this.width = width,
        this.height = height;
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
    constructor(seed){
        this.viewports = [];
        this.random = new SeededRandom(seed);
        this.stars = 60;
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
                // let topLeft = centre.add(new Vector(-400,-400).multiply(viewport.zoom));
                // viewport.canvas.fillRect(topLeft.x, topLeft.y, 800*viewport.zoom, 800*viewport.zoom);
                // const { width, height } = viewport.canvas.getBoundingClientRect();
                viewport.canvas.fillRect(0, 0, viewport.width, viewport.height);

                //stars are in screen, not world, coordinates
                for(let i=0;i<this.stars;i++)
                {
                    let maxDist=200;
                    let tempX=this.random.next()*this.worldWidth;
                    let tempY=this.random.next()*this.worldHeight;
                    let tempR=this.random.next()*2;
                    // let starPos = viewport.translate(new Vector(this.random.next()*viewport.width, this.random.next()*viewport.height))
                    let starPos = new Vector(this.random.next()*viewport.width, this.random.next()*viewport.height);
                    
                    // let nearBH=this.nearHere([tempX,tempY] , blackHoles , maxDist);
                    //
                    // if(nearBH!==false)
                    // {
                    //     let angle=Math.atan2(blackHoles[nearBH][1] - tempY , blackHoles[nearBH][0] - tempX);
                    //     let realDist=Math.sqrt(Math.pow(blackHoles[nearBH][0] - tempX , 2) + Math.pow(blackHoles[nearBH][1] - tempY , 2));
                    //     let dist=(maxDist - realDist)/25;
                    //     if(realDist > 50)
                    //     {
                    //         //if star isn't too clos to black hole, draw it being sucked in.
                    //         viewport.canvas.beginPath();
                    //         //white to tinted yellow
                    //         viewport.canvas.lineWidth=tempR;
                    //         viewport.canvas.lineCap="round";
                    //         viewport.canvas.strokeStyle="rgb(255,255,"+Math.round(this.random.next()*100+155)+")";
                    //         viewport.canvas.moveTo((tempX-viewport.canvas.x)*viewport.canvas.zoom , (tempY-viewport.canvas.y)*viewport.canvas.zoom);
                    //         viewport.canvas.lineTo((tempX+Math.cos(angle)*dist-viewport.canvas.x)*viewport.canvas.zoom , (tempY+Math.sin(angle)*dist-viewport.canvas.y)*viewport.canvas.zoom);
                    //         viewport.canvas.stroke();
                    //     }
                    //     else
                    //     {
                    //         //to keep rest of stars the same if a black hole moves
                    //         this.random.next();
                    //     }
                    // }
                    // else
                    {
                        viewport.canvas.beginPath();
                        //white to tinted yellow
                        viewport.canvas.fillStyle="rgb(255,255,"+Math.round(this.random.next()*100+155)+")";
                        viewport.canvas.arc(starPos.x, starPos.y , tempR , 0 , Math.PI*2 , true);
                        viewport.canvas.fill();
                    }
                }


            }
        }
    }
}