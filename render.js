
import { Vector, polar, SeededRandom } from "./geometry.js"

export class Viewport{
    constructor(centre, zoom, canvas, width, height, enabled = true){
        this.centre = centre;
        this.width = width,
        this.height = height;
        // world units * zoom = pixels
        this.zoom = zoom;
        this.canvas = canvas;
        this.enabled = enabled;
        // this.canvasCentre = new Vector(width*0.5/zoom, height*0.5/zoom);

        this.topLeftInWorld = centre.subtract(new Vector(width*0.5/zoom, height*0.5/zoom))
    }
    //translate from world coords to canvas coordinates
    translate(position){
        
        return position.subtract(this.topLeftInWorld).multiply(this.zoom);//multiply(this.zoom).add(this.canvasCentre);
    }

    translateFromPixelToWorld(pixelPosition){
        return pixelPosition.multiply(1/this.zoom).add(this.topLeftInWorld)
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

    render(world){
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
                    let maxDist=100;
                    let radius=this.random.next()*2;
                    
                    //position in screen coordinates
                    let starPos = new Vector(this.random.next()*viewport.width, this.random.next()*viewport.height);
                    
                    let colour = "rgb(255,255,"+Math.round(this.random.next()*100+155)+")";
                    
                    let starSimulatedPosition = viewport.translateFromPixelToWorld(starPos);

                    let blackhole=world.nearestBlackhole(starSimulatedPosition, maxDist);
                    
                    if(blackhole!=null)
                    {
                        let angle=starSimulatedPosition.angleTo(blackhole.position)
                        // let pixelDistance=viewport.translate(blackhole.position).distanceTo(starPos);
                        // let dist=pixelDistance/viewport.zoom;
                        let distance = blackhole.position.distanceTo(starSimulatedPosition);
                        if(distance > 25)
                        {
                            let lineLength = viewport.zoom*(maxDist - distance)/10
                            //if star isn't too clos to black hole, draw it being sucked in.
                            viewport.canvas.beginPath();
                            //white to tinted yellow
                            viewport.canvas.lineWidth=radius;
                            viewport.canvas.lineCap="round";
                            viewport.canvas.strokeStyle=colour;
                            viewport.canvas.moveTo(starPos.x, starPos.y);
                            let toPos = starPos.add(polar(angle, lineLength));
                            viewport.canvas.lineTo(toPos.x, toPos.y);
                            viewport.canvas.stroke();

                            if(false){
                                viewport.canvas.beginPath();
                                viewport.canvas.fillStyle="rgb(255,255,0)";
                                let blackholePosition = viewport.translate(blackhole.position)
                                viewport.canvas.arc(blackholePosition.x, blackholePosition.y , 10 , 0 , Math.PI*2 , true);
                                viewport.canvas.fill();
                            }
                        }
                        else
                        {
                            //to keep rest of stars the same if a black hole moves
                            this.random.next();
                        }
                    }
                    else
                    {
                        viewport.canvas.beginPath();
                        //white to tinted yellow
                        viewport.canvas.fillStyle=colour;
                        viewport.canvas.arc(starPos.x, starPos.y , radius , 0 , Math.PI*2 , true);
                        viewport.canvas.fill();
                    }
                }

                for(const ship of world.ships){
                    let shipPos = viewport.translate(ship.position);
                    viewport.canvas.beginPath();
                    viewport.canvas.arc(shipPos.x, shipPos.y, ship.radius*viewport.zoom, 0, Math.PI*2, true)
                    viewport.canvas.fillStyle=ship.rgb;
                    viewport.canvas.fill();
                }

                for(const planet of world.planets){
                    let planetPos = viewport.translate(planet.position);
                    let topleftwards = polar(Math.PI*1.25, planet.radius);
                    let planetTopLeft = viewport.translate(planet.position.add(topleftwards))
                    let grad =viewport.canvas.createRadialGradient(planetTopLeft.x,planetTopLeft.y, 0 ,planetPos.x, planetPos.y, planet.radius*2* viewport.zoom);
	
					grad.addColorStop(0, planet.colour);
					//grad.addColorStop(0.8, Render.colourToRGB(Render.colourChangeBy(planet_wars.objects[i].colour,-192)));
					grad.addColorStop(0.9, "rgb(0,0,0)");

                    viewport.canvas.beginPath();
                    viewport.canvas.fillStyle = grad;
                    // viewport.canvas.moveTo(planetPos.x, planetPos.y);
                    // viewport.canvas.arc((planet_wars.objects[i].pos[0] - viewport.x) * viewport.zoom, (planet_wars.objects[i].pos[1] - viewport.y) * viewport.zoom, planet_wars.objects[i].r * viewport.zoom, 0, Math.PI * 2, true);
                    viewport.canvas.arc(planetPos.x, planetPos.y , planet.radius*viewport.zoom , 0 , Math.PI*2 , true);
                    viewport.canvas.fill();
				}
				
				
				


            }
        }
    }
}