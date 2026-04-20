
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

    clear(){
        this.canvas.clearRect(0, 0, this.width, this.height);
    }

    centrePixel(n){
        return Math.ceil(n-0.5);
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
 * 
 * note - I've randomly chosen between calling things "draw" and "render". TODO maybe use draw for small components and render for whole canvases?
 */
export class WorldRenderer{
    constructor(seed, world){
        this.backgroundViewports = [];
        this.liveViewports = [];
        this.trailsViewports = [];
        this.random = new SeededRandom(seed);
        this.seed = seed;
        this.stars = 60;
        this.world = world;
    }

    addBackgroundViewport(viewport){
        this.backgroundViewports.push(viewport)
    }

    addLiveViewport(viewport){
        this.liveViewports.push(viewport)
    }

    addTrailsViewport(viewport){
        this.trailsViewports.push(viewport)
    }

    

    renderBackground(){
        //reset random for the background every time
        this.random = new SeededRandom(this.seed);
        const world = this.world;
        for(const viewport of this.backgroundViewports){
            if(viewport.enabled){
                let centre = viewport.translate(new Vector(0,0));
                // viewport.canvas.beginPath();
                // // viewport.canvas.fillStyle = grad;
                // viewport.canvas.arc(centre.x, centre.y, 400, 0, Math.PI * 2, true);
                // viewport.canvas.fill();
                // let topLeft = centre.add(new Vector(-400,-400).multiply(viewport.zoom));
                // viewport.canvas.fillRect(topLeft.x, topLeft.y, 800*viewport.zoom, 800*viewport.zoom);
                // const { width, height } = viewport.canvas.getBoundingClientRect();
                viewport.canvas.fillStyle="rgb(0,0,0)";
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
                            //to keep rest of stars the same if a black hole is added
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

                

                for(const planet of world.planets){
                    let planetPos = viewport.translate(planet.position);
                    let topleftwards = polar(Math.PI*1.25, planet.radius);
                    let planetTopLeft = viewport.translate(planet.position.add(topleftwards))
                    let grad =viewport.canvas.createRadialGradient(planetTopLeft.x,planetTopLeft.y, 0 ,planetPos.x, planetPos.y, planet.radius*2* viewport.zoom);
	
					grad.addColorStop(0, planet.colour);
					grad.addColorStop(0.9, "rgb(0,0,0)");

                    if (planet.ring)
                    {
                        this.drawRings(planet, viewport);
                    }

                    viewport.canvas.beginPath();
                    viewport.canvas.fillStyle = grad;
                    viewport.canvas.arc(planetPos.x, planetPos.y , planet.radius*viewport.zoom , 0 , Math.PI*2 , true);
                    viewport.canvas.fill();

                    if (planet.ring)
                    {
                        this.drawRings(planet, viewport, false);
                    }
				}
				
                for(const spaceStation of world.spaceStations){
                    this.drawSpaceStation(viewport, spaceStation);
                }
				
				for(const ship of world.ships){
                    this.drawShip(ship, viewport);
                }


            }
        }
    }

    /**
     * Based on the one from planet wars 2 which was taken from the original
     * @param {*} viewport 
     * @param {*} spaceStation 
     */
    drawSpaceStation(viewport, spaceStation){
        let centre = viewport.translate(spaceStation.position);
        let radius = spaceStation.radius * viewport.zoom;

        //left to right
        // let bodyGradient = viewport.canvas.createRadialGradient(centre.x - radius*1.25, centre.y, 0, centre.x+radius, centre.y, radius*3)
        let bodyGradient = viewport.canvas.createLinearGradient(centre.x - radius, centre.y, centre.x+radius, centre.y)
        bodyGradient.addColorStop(0, 'rgb(0,0,0)');
        bodyGradient.addColorStop(1, 'rgb(128,128,128)');

        let firingDimpleGradient = viewport.canvas.createLinearGradient(centre.x, centre.y, centre.x+radius, centre.y);
        firingDimpleGradient.addColorStop(0,'rgb(128,128,128)');
        firingDimpleGradient.addColorStop(1,'rgb(0,0,0)');

        let centreBandGradient = viewport.canvas.createLinearGradient(centre.x - radius, centre.y, centre.x + radius, centre.y);
        centreBandGradient.addColorStop(0,'rgb(10,10,10)');
        centreBandGradient.addColorStop(1,'rgb(135,135,135)');

        viewport.canvas.beginPath()
        viewport.canvas.moveTo(centre.x,centre.y)
        viewport.canvas.fillStyle=bodyGradient;
        viewport.canvas.arc(centre.x,centre.y,radius,0,Math.PI*2,true);
        viewport.canvas.fill();
        
        viewport.canvas.beginPath()
        viewport.canvas.moveTo(centre.x+radius/3,centre.y-radius/3-2)
        viewport.canvas.fillStyle=firingDimpleGradient;
        viewport.canvas.arc(centre.x+radius/3,centre.y-radius/3-2,radius/3.5,0,Math.PI*2,true);
        viewport.canvas.fill();
        
        viewport.canvas.fillStyle = centreBandGradient;
        let mainBandHigh = radius*0.15;
        viewport.canvas.fillRect(centre.x-radius,centre.y-mainBandHigh/2,radius*2,mainBandHigh);
        
        // viewport.canvas.fillStyle = "rgb(50,50,50)";
        // let smallBandHigh = radius*0.05;
        // viewport.canvas.fillRect(centre.x-radius,centre.y - smallBandHigh/2,radius*2,smallBandHigh);
    }

    // renderShips(){
    //      for(const viewport of this.shipsViewports){
    //         if(viewport.enabled){
    //             for(const ship of world.ships){
    //                 this.drawShip(ship, viewport);
    //             }
    //         }
    //     }
    // }

    renderTrails(){
        const world = this.world;
        for(const viewport of this.trailsViewports){
            if(viewport.enabled){
                for(const missile of world.missiles){
                    // let oldPosition = viewport.translate(missile.oldPosition);
                    // let newPosition = viewport.translate(missile.position);
                    if(missile.oldPositions.length <= 1){
                        continue;
                    }
                    for(let i=1; i< missile.oldPositions.length; i++){
                        const oldPosition = viewport.translate(missile.oldPositions[i-1]);
                        const newPosition = viewport.translate(missile.oldPositions[i]);
                        viewport.canvas.beginPath();
                        viewport.canvas.lineWidth=2;
                        viewport.canvas.lineCap="round";
                        viewport.canvas.strokeStyle=missile.colour;
                        viewport.canvas.moveTo(oldPosition.x, oldPosition.y);
                        viewport.canvas.lineTo(newPosition.x, newPosition.y);
                        viewport.canvas.stroke();
                    }

                }
            }
        }
    }

    dimTrails(dimBy=0.8){
        //decrease opacity of trails to slowly fade old trails
        for(const viewport of this.trailsViewports){
            if(viewport.enabled){
                const imageData = viewport.canvas.getImageData(0, 0, viewport.width, viewport.height)
                const data = imageData.data;
                // data is r,g,b,a 
                for(let i =0; i<data.length; i+=4){
                    data[i+3] = Math.floor(data[i+3]*dimBy);
                }
                viewport.canvas.putImageData(imageData, 0, 0);
            }
        }
    }
    /**
     * 
     * @param {*} viewport 
     * @param {*} ship 
     * @param {*} angle 
     * @param {*} previousAngles  list of previously fired shots, NEWEST first
     */
    renderAimingRecepticle(viewport, ship, angle, previousAngles){
        viewport.clear();
        const centre = viewport.translate(ship.position);
        const radius = 100;
        const lineRadius = 110;
        const textHeight=15;
        const textRadius = lineRadius + textHeight*0.75;

        //blank out the old ship in the background
        viewport.canvas.beginPath();
        viewport.canvas.fillStyle="rgb(0,0,0)";
        viewport.canvas.arc(centre.x, centre.y,ship.radius*1.2*viewport.zoom,0,Math.PI*2,true);
        viewport.canvas.fill();

        //grey circle
        viewport.canvas.beginPath();
        viewport.canvas.fillStyle="rgba(32,32,32,0.85)";
        viewport.canvas.arc(centre.x ,centre.y, radius, 0, Math.PI*2, true);
        viewport.canvas.fill();

        //white lines
        viewport.canvas.beginPath();
        viewport.canvas.lineWidth=1;
        viewport.canvas.strokeStyle="rgba(255,255,255,0.75)";
        viewport.canvas.lineCap = "round";
        viewport.canvas.arc(centre.x ,centre.y, radius, 0, Math.PI*2, true);
        //vertical line
        viewport.canvas.moveTo(viewport.centrePixel(centre.x - lineRadius) , viewport.centrePixel(centre.y));
        viewport.canvas.lineTo(viewport.centrePixel(centre.x + lineRadius) , viewport.centrePixel(centre.y));
        //horizontal
        viewport.canvas.moveTo(viewport.centrePixel(centre.x) , viewport.centrePixel(centre.y - lineRadius));
        viewport.canvas.lineTo(viewport.centrePixel(centre.x) , viewport.centrePixel(centre.y + lineRadius));
        viewport.canvas.stroke();

        

        viewport.canvas.textAlign="center";
        viewport.canvas.textBaseline = "middle";
        viewport.canvas.font = `${textHeight}px Gill Sans`;
        viewport.canvas.fillStyle="rgb(255,255,255)";
        // text
        // left
        viewport.canvas.fillText('270', centre.x - textRadius, centre.y);
        // right
        viewport.canvas.fillText('090', centre.x + textRadius, centre.y);
        // top
        viewport.canvas.fillText('000', centre.x , centre.y- textRadius + textHeight/4);
        //bottom
        viewport.canvas.fillText('180', centre.x , centre.y + textRadius - textHeight/4);

        // old shot markers
        let alpha = 1.0;
        for(const oldAngle of previousAngles){
            viewport.canvas.beginPath();
            viewport.canvas.fillStyle=ship.colour.toString(alpha);
            const pos = centre.add(polar(oldAngle, radius));
            viewport.canvas.arc(pos.x ,pos.y, 3, 0, Math.PI*2, true);
            viewport.canvas.fill();
            alpha *= 0.8;
        }


        //arrow
        const lefttip = centre.add(polar(angle-Math.PI/32, radius*0.91));
        const tip = centre.add(polar(angle,radius));
        const righttip = centre.add(polar(angle+Math.PI/32, radius*0.91));

        viewport.canvas.beginPath();
        viewport.canvas.strokeStyle=ship.colour.toString(0.75);
        viewport.canvas.moveTo(lefttip.x, lefttip.y);
        viewport.canvas.lineTo(tip.x, tip.y);
        viewport.canvas.lineTo(righttip.x, righttip.y);
        viewport.canvas.stroke();

        viewport.canvas.beginPath();
        viewport.canvas.moveTo(centre.x, centre.y);
        viewport.canvas.lineTo(tip.x, tip.y);
        viewport.canvas.stroke();
        

        this.drawShip(ship, viewport, angle, true);
    }

    drawCrate(viewport, crate){

        let centre = viewport.translate(crate.position);
        let radius = viewport.zoom*crate.radius;

        viewport.canvas.beginPath();
        for(let i=0;i<crate.sides;i++){
            let angle = i*Math.PI*2/crate.sides + crate.angle;
            let pos = centre.add(polar(angle, radius))
            if(i==0){
                viewport.canvas.moveTo(pos.x, pos.y);
            }else{
                viewport.canvas.lineTo(pos.x, pos.y)
            }
        }
        viewport.canvas.fill();
    }

    renderLive(){
        const world = this.world;
        for(const viewport of this.liveViewports){
            if(viewport.enabled){
                let viewportEdgeRadius = viewport.width*0.5/viewport.zoom;
                viewport.clear();
                for(const missile of world.missiles){
                    let missileRadius = missile.radius*viewport.zoom*3;
                
                    //just a tiny bit further
                    let maxDistanceSqrd = Math.pow(viewportEdgeRadius + missileRadius, 2);

                    if (missile.position.magnitudeSquared() < maxDistanceSqrd){
                        let pixelPosition = viewport.translate(missile.position);
                        viewport.canvas.beginPath();
                        viewport.canvas.arc(pixelPosition.x, pixelPosition.y, missileRadius, 0, Math.PI*2, true)
                        viewport.canvas.fillStyle=missile.colour;
                        viewport.canvas.fill();
                    }else{
                        //draw a little arrow
                        const arrowLength = 20;
                        let angleFromCentre = new Vector(0,0).angleTo(missile.position);
                        let edgePosPixel = viewport.translate(polar(angleFromCentre, viewportEdgeRadius));
                        let arrowTailPosPixel = viewport.translate(polar(angleFromCentre, viewportEdgeRadius - arrowLength/viewport.zoom));
                        let leftTip = edgePosPixel.add(polar(angleFromCentre + Math.PI*0.75, arrowLength*0.2))
                        let rightTip = edgePosPixel.add(polar(angleFromCentre - Math.PI*0.75, arrowLength*0.2))
                        viewport.canvas.beginPath();
                        viewport.canvas.moveTo(arrowTailPosPixel.x, arrowTailPosPixel.y);
                        viewport.canvas.lineTo(edgePosPixel.x, edgePosPixel.y);
                        viewport.canvas.moveTo(leftTip.x, leftTip.y);
                        viewport.canvas.lineTo(edgePosPixel.x, edgePosPixel.y);
                        viewport.canvas.lineTo(rightTip.x, rightTip.y);
                        viewport.canvas.strokeStyle=missile.colour;
                        viewport.canvas.lineWidth=2;
                        viewport.canvas.stroke();
                    }
                }
            }
        }
    }

    renderAllLiveViewports(){
        this.renderTrails();
        this.renderLive();
    }

    /**
     * Ported from old planet wars, haven't switched everything over to new vectors as it works fine
     * @param {*} ship 
     * @param {*} viewport 
     */
    drawShip=function(ship, viewport, angle=undefined, ignoreShield=false)
    {

        

        let r=ship.radius;	
        // let tempPos=new Array(2);
        if (angle === undefined){
            angle = ship.angle;
        }
        let shipPositionPixels = viewport.translate(ship.position);
        // tempPos[0]=pos[0]+Math.cos(angle)*r*0.1;
        // tempPos[1]=pos[1]+Math.sin(angle)*r*0.1;
        let bodyCentre = ship.position.add(polar(ship.angle, r*0.1));
        
        
        
        // let belowExhast = [tempPos[0] + Math.cos(angle + Math.PI * 0.9) * r * 0.75, tempPos[1] + Math.sin(angle + Math.PI * 0.9) * r * 0.75];
        let belowExhast = viewport.translate(bodyCentre.add(polar(angle + Math.PI*0.9, r*0.75)));
        // let aboveExhast = [tempPos[0] + Math.cos(angle - Math.PI * 0.9) * r * 0.75, tempPos[1] + Math.sin(angle - Math.PI * 0.9) * r * 0.75];
        let aboveExhast =  viewport.translate(bodyCentre.add(polar(angle - Math.PI*0.9, r*0.75)));
        
        let nose =  viewport.translate(bodyCentre.add(polar(angle, r)));//[tempPos[0] + Math.cos(angle) * r, tempPos[1] + Math.sin(angle) * r];
        
        bodyCentre =  viewport.translate(bodyCentre);
        // r = r*viewport.zoom;

        viewport.canvas.strokeStyle = "black";
        viewport.canvas.lineWidth = r/8
        viewport.canvas.lineCap = 'round';
        
        let bodyFunc = function()
        {
            //bottom of body
            //above exhast
            viewport.canvas.moveTo((belowExhast.x), (belowExhast.y))
            
            viewport.canvas.bezierCurveTo((bodyCentre.x + Math.cos(angle + Math.PI * 0.6) * r*viewport.zoom * 1.3), (bodyCentre.y + Math.sin(angle + Math.PI * 0.6) * r*viewport.zoom * 1.3), (bodyCentre.x + Math.cos(angle + Math.PI * 0.2) * r*viewport.zoom), (bodyCentre.y + Math.sin(angle + Math.PI * 0.2) * r*viewport.zoom), (nose.x), (nose.y));
            //front
            viewport.canvas.bezierCurveTo((bodyCentre.x + Math.cos(angle - Math.PI * 0.2) * r*viewport.zoom), (bodyCentre.y + Math.sin(angle - Math.PI * 0.2) * r*viewport.zoom), (bodyCentre.x + Math.cos(angle - Math.PI * 0.6) * r*viewport.zoom * 1.3), (bodyCentre.y + Math.sin(angle - Math.PI * 0.6) * r*viewport.zoom * 1.3), (aboveExhast.x), (aboveExhast.y));
            viewport.canvas.lineTo((belowExhast.x), (belowExhast.y));
            
            //viewport.canvas.bezierCurveTo( bodyCentre.x+Math.cos(angle+Math.PI*0.25)*r , bodyCentre.y+Math.sin(angle+Math.PI*0.25)*r , bodyCentre.x+Math.cos(angle+Math.PI*0.75)*r*2 , bodyCentre.y+Math.sin(angle+Math.PI*0.75)*r*2  , bodyCentre.x+Math.cos(angle+Math.PI*0.9)*r , bodyCentre.y+Math.sin(angle+Math.PI*0.9)*r)
        }
        
        let finFunc = function()
        {
            viewport.canvas.moveTo((belowExhast.x + Math.cos(angle) * r * 0.5), (belowExhast.y + Math.sin(angle) * r * 0.5));
            viewport.canvas.arc((belowExhast.x), (belowExhast.y), r * 0.5*viewport.zoom, angle, angle + Math.PI * 0.8, false)
            viewport.canvas.lineTo((belowExhast.x), (belowExhast.y));
            
            viewport.canvas.moveTo((aboveExhast.x + Math.cos(angle) * r * 0.5), (aboveExhast.y + Math.sin(angle) * r * 0.5));
            viewport.canvas.arc((aboveExhast.x), (aboveExhast.y), r * 0.5*viewport.zoom, angle, angle - Math.PI * 0.8, true)
            viewport.canvas.lineTo((aboveExhast.x), (aboveExhast.y));
        }
        
        let flame1Func = function()
        {
            viewport.canvas.moveTo((belowExhast.x), (belowExhast.y));
            viewport.canvas.quadraticCurveTo((bodyCentre.x + Math.cos(angle + Math.PI * 0.9) * r), (bodyCentre.y + Math.sin(angle + Math.PI * 0.9) * r), (bodyCentre.x + Math.cos(angle + Math.PI) * r * 1.2), (bodyCentre.y + Math.sin(angle + Math.PI) * r * 1.2))
            viewport.canvas.quadraticCurveTo((bodyCentre.x + Math.cos(angle - Math.PI * 0.9) * r), (bodyCentre.y + Math.sin(angle - Math.PI * 0.9) * r), (aboveExhast.x), (aboveExhast.y))
        }
        
        let flame2Func = function()
        {
            viewport.canvas.moveTo((belowExhast.x + Math.cos(angle - Math.PI / 2) * r * 0.1), (belowExhast.y + Math.sin(angle - Math.PI / 2) * r * 0.1));
            viewport.canvas.quadraticCurveTo((bodyCentre.x + Math.cos(angle + Math.PI * 0.9) * r * 0.9), (bodyCentre.y + Math.sin(angle + Math.PI * 0.9) * r * 0.9), (bodyCentre.x + Math.cos(angle + Math.PI) * r * 1.1), (bodyCentre.y + Math.sin(angle + Math.PI) * r * 1.1))
            viewport.canvas.quadraticCurveTo((bodyCentre.x + Math.cos(angle - Math.PI * 0.9) * r * 0.9), (bodyCentre.y + Math.sin(angle - Math.PI * 0.9) * r * 0.9), (aboveExhast.x + Math.cos(angle + Math.PI / 2) * r * 0.1), (aboveExhast.y + Math.sin(angle + Math.PI / 2) * r * 0.1))
        }

        let shipColour = ship.colour;
        if (!ship.alive){
            shipColour = ship.colour.adjustBrightness(0.5);
        }
        
        viewport.canvas.fillStyle = shipColour;
        viewport.canvas.beginPath()
        finFunc();
        viewport.canvas.fill();
        
        viewport.canvas.beginPath()
        finFunc();
        viewport.canvas.stroke();
        
        viewport.canvas.fillStyle = "rgb(255,255,0)";
        viewport.canvas.beginPath()
        flame1Func();
        viewport.canvas.fill();
        
        viewport.canvas.fillStyle = "rgb(255,128,0)";
        viewport.canvas.beginPath()
        flame2Func();
        viewport.canvas.fill();
        
        
        viewport.canvas.fillStyle = shipColour;
        viewport.canvas.beginPath();
        bodyFunc();
        viewport.canvas.fill()
        
        
        viewport.canvas.beginPath();
        bodyFunc();
        viewport.canvas.stroke();
        
        viewport.canvas.fillStyle = "rgb(132,132,0)"
        viewport.canvas.beginPath();
        viewport.canvas.arc((bodyCentre.x + Math.cos(angle) * r * 0.3*viewport.zoom), (bodyCentre.y + Math.sin(angle) * r * 0.3*viewport.zoom), r * 0.2*viewport.zoom, 0, Math.PI * 2, false);
        
        viewport.canvas.fill();
        
        viewport.canvas.beginPath();
        //viewport.canvas.moveTo(bodyCentre.x+Math.cos(angle)*r*0.3 + r*0.2 , bodyCentre.y+Math.sin(angle)*r*0.3)
        
        viewport.canvas.arc((bodyCentre.x + Math.cos(angle) * r * 0.3*viewport.zoom), (bodyCentre.y + Math.sin(angle) * r * 0.3*viewport.zoom), r * 0.2*viewport.zoom, 0, Math.PI * 2, false);
        
        viewport.canvas.stroke();

        if(ship.shieldActive && !ignoreShield){

            let shieldRadius = ship.radius*1.4*viewport.zoom
            let topLeft = shipPositionPixels.add(polar(ship.angle,shieldRadius))//new Vector(shieldRadius, shieldRadius)
            let bottomRight = shipPositionPixels.add(polar(ship.angle+Math.PI,shieldRadius))
            let grad = viewport.canvas.createRadialGradient(topLeft.x, topLeft.y, 0, bottomRight.x, bottomRight.y, shieldRadius*2);
            
            grad.addColorStop(0, "rgba(0,0,0,0.6)");
            grad.addColorStop(1, ship.colour.toString(0.3));
            
            viewport.canvas.beginPath();
            viewport.canvas.fillStyle=grad;
            viewport.canvas.arc(shipPositionPixels.x, shipPositionPixels.y, shieldRadius, 0, Math.PI * 2, false);
            viewport.canvas.fill();

            viewport.canvas.beginPath();
            viewport.canvas.lineWidth = 1;
            viewport.canvas.strokeStyle=ship.colour.toString(0.75);
            viewport.canvas.arc(shipPositionPixels.x, shipPositionPixels.y, shieldRadius, 0, Math.PI * 2, false);
            viewport.canvas.stroke();
        }
        
    }

    /**
     * Ported from planet wars 2, which copied it from the original. Updated to use vectors and a bit of tidy up, but it's the same old old logic!
     * @param {*} planet 
     * @param {*} viewport 
     * @param {*} bottom 
     * @param {*} ringColour 
     */
    drawRings(planet, viewport, bottom=true, ringColour='rgb(192,192,192)')
    {
        let radius=planet.radius;
        let bigRadius=radius*1.25
        let angle=planet.angle;

        let left = planet.position.add(polar(angle + Math.PI, bigRadius));
        let leftPixels = viewport.translate(left);

        let right = planet.position.add(polar(angle, bigRadius));
        let rightPixels = viewport.translate(right);

        let leftUpper = left.add(polar(angle - Math.PI/2, radius));
        let leftUpperPixels = viewport.translate(leftUpper);

        let leftDown = left.add(polar(angle + Math.PI/2, radius));
        let leftDownPixels = viewport.translate(leftDown);

        let rightUpper = right.add(polar(angle - Math.PI/2, radius));
        let rightUpperPixels = viewport.translate(rightUpper);

        let rightDown = right.add(polar(angle + Math.PI/2, radius));
        let rightDownPixels = viewport.translate(rightDown);
        
        //ignoring angle, for the gradient
        let topLeftPixel = viewport.translate(planet.position.add(new Vector(-bigRadius, -bigRadius)));
        let bottomRightPixel = viewport.translate(planet.position.add(new Vector(bigRadius, bigRadius)));

        let grad2 = viewport.canvas.createLinearGradient(topLeftPixel.x , topLeftPixel.y , bottomRightPixel.x , bottomRightPixel.y);
        grad2.addColorStop(0, ringColour);
        grad2.addColorStop(1,'rgb(0,0,0)');
        
        viewport.canvas.beginPath();
        viewport.canvas.moveTo(leftPixels.x, leftPixels.y);
        viewport.canvas.strokeStyle=grad2
        viewport.canvas.lineCap='round';

        if (bottom){
            //drawn before the planet

            viewport.canvas.lineWidth=planet.radius*viewport.zoom/5;
            
            
            viewport.canvas.bezierCurveTo(leftUpperPixels.x, leftUpperPixels.y, rightUpperPixels.x, rightUpperPixels.y , rightPixels.x , rightPixels.y);
            
        }else{
            //drawn on top of the planet
            
            viewport.canvas.lineWidth=planet.r*viewport.zoom/5;
            viewport.canvas.bezierCurveTo(leftDownPixels.x, leftDownPixels.y, rightDownPixels.x, rightDownPixels.y, rightPixels.x , rightPixels.y);
        }

        viewport.canvas.stroke();
    }
}