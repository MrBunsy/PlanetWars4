import { WorldRenderer, Viewport } from "./render.js";
import { World } from "./world.js";
import { polar, Vector } from "./geometry.js";


export class Player{
    constructor(index, name = "Unnamed Player"){
        this.index = index;
        this.name = name;
        this.ship = null;
        this.shields = 3;
        this.previousShotsDegrees = [];
    }

    setShip(ship){
        this.ship = ship;
    }

    getAvailableActions(){
        //TODO actions might want to be objects with options, for now just strings until I've got a better idea of what I'll implement
        let actions = ["missile"]
        if (this.shields > 0){
            actions.push("shield")
        }
        return actions;
    }
}

export class PlanetWarsMatch{
    /**
     * Idea - this will perform some of the UI interactions so there isn't too much of that (or ideally any) in the PlanetWarsSocketClient
     * This can be shared between multiplayer and debug
     * this will provide a (hopefully) clean API that the multiplayer can interact with.
     */
    constructor(mainGameDiv, players){
        this.mainGameDiv = mainGameDiv;
        this.actionChooserDiv = mainGameDiv.querySelector("#action_chooser");
        this.fireControlDiv = mainGameDiv.querySelector("#fire_control");

        this.fireControlForm = this.fireControlDiv.querySelector("form")

        this.fireControlAngleInput = this.fireControlForm.querySelector("input[name='angle']")

        this.topCanvasElement = document.getElementById("planet_wars2")

        this.world = null;
        this.renderer = null;
        this.players = players;
        this.playerFireMissileCallback = (player, angleRadians)=>{
            console.log(`Fire missile ${player.index}: ${this.radiansToDegrees(angleRadians)}`)
        }

        this.simulationFinishedCallback = ()=>{
            console.log(`Simulation finished`);
        }

        this.fps = 30;
        this.delay_ms = 1000/this.fps;
        //smallest timestep we'll simulate. if I get runge kutta working, might be able to increase this to lower CPU usage
        this.physicsSteps_ms = 5;

        //how fast to playback simulation. Want it slow enough to be fun to watch, but not so slow as to get boring
        this.simulationSpeed = 0.4;
    }

    setPlayerFireMissileCallback(callback){
        this.playerFireMissileCallback = callback;
    }

    setSimulationFinishedCallback(callback){
        this.simulationFinishedCallback = callback
    }

    newRound(seed){
        let radius = 400;
        if (this.players.length > 4){
            radius = 500;
        }
        this.world = new World(this.players.length, seed, radius);
        this.renderer = new WorldRenderer(seed, this.world);

        let canvas_size = parseInt(document.getElementById("planet_wars0").width);
        let zoom = (canvas_size/2)/this.world.radius
// // zoom = 0.5;
        //TODO create these canvases here?
        this.renderer.addBackgroundViewport(new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars0").getContext("2d"), canvas_size, canvas_size))
        let missileTrailsViewPort = new Viewport(new Vector(0,0), zoom, document.getElementById("planet_wars1").getContext("2d"), canvas_size, canvas_size);
        let missileViewPort = new Viewport(new Vector(0,0), zoom, this.topCanvasElement.getContext("2d"), canvas_size, canvas_size);
        this.renderer.addLiveViewport(missileViewPort);
        this.renderer.addTrailsViewport(missileTrailsViewPort)
        
        this.renderer.renderBackground(this.world)

        for(let i =0; i<this.players.length; i++){
            this.players[i].setShip(this.world.ships[i]);
        }
        console.log(`New round: zoom ${zoom}, world radius: ${radius}, canvas_size: ${canvas_size}`)
    }

    planMove(player){
        //provide options
        this.actionChooserDiv.classList.remove("hidden");
        this.actionChooserDiv.innerHTML="Choose Move:"
        for (const action of player.getAvailableActions()){
            let button = document.createElement("button");
            button.value=action;
            button.innerHTML = action;
            button.onclick=() =>{
                this.planMoveStage2(player, action);
            }
            this.actionChooserDiv.appendChild(button);
        }
        
    }

    

    /**
     * bind mouse ups and downs and render aim receptical
     * @param {*} player 
     */
    aimMissile(player){
        
        let previousShot = this.tidyAngle(player.ship.angle)
        if(player.previousShotsDegrees.length > 0){
            previousShot = player.previousShotsDegrees[player.previousShotsDegrees.length-1];
        }
        this.drawAimRecepticle(player, parseFloat(previousShot));
        this.fireControlDiv.classList.remove("hidden");
        this.fireControlAngleInput.value=previousShot;
        this.fireControlForm.onsubmit = (event) =>{
            event.preventDefault();
            this.userFiresMissile();
            return false;
        }



        this.firingPlayer = player;
        this.mouseDown = false;
        this.mousePos = new Vector(0,0);
        this.aimingInterval = setInterval(this.missileAimLoop.bind(this), 50);

        this.missileAimLoop();

        this.topCanvasElement.onmousedown=(e)=>{this.mouseDown = true;}
        document.onmouseup = (e) => {this.mouseDown = false;}
        document.onmousemove = (e) => {
            let rect = this.topCanvasElement.getBoundingClientRect();
            let x = e.clientX - rect.left; //x position within the element.
            let y = e.clientY - rect.top;  //y position within the element.
            this.mousePos = new Vector(x,y);
        }
    }

    userFiresMissile(){
        clearInterval(this.aimingInterval);
        this.fireControlDiv.classList.add("hidden");
        let angleRads = this.degreesToRadians(parseFloat(this.fireControlAngleInput.value));
        this.firingPlayer.previousShotsDegrees.push(this.fireControlAngleInput.value)
        this.playerFireMissileCallback(this.firingPlayer, angleRads);
    }

    shipFiresMissile(player, angleRadians){
        this.world.fireMissile(player.index, polar(angleRadians, this.world.maxMissileSpeed));
    }

    /**
     * From 0 pointing upwards in degrees to 0 pointing rightwards in radians
     * @param {*} degrees 
     * @returns 
     */
    degreesToRadians(degrees){
        return Math.PI*2*(degrees - 90)/360
    }

    /**
     * From 0 pointing rightwards in radians to 0 pointing upwards in degrees
     * @param {*} radians 
     */
    radiansToDegrees(radians){
        return 360*(radians + Math.PI/2)/(Math.PI*2);
    }

    drawAimRecepticle(player, currentAngleDegrees){
        let oldAnglesRadians = []
        for(const oldAngleDeg of player.previousShotsDegrees){
            oldAnglesRadians.unshift(this.degreesToRadians(oldAngleDeg))
        }


        this.renderer.renderAimingRecepticle(this.renderer.liveViewports[0], player.ship, this.degreesToRadians(currentAngleDegrees), oldAnglesRadians);
    }

    tidyAngle(radians){
        //turn radians (from +ve x axis rotating clockwise) into a nice round degrees (from -ve y axis rotating clockwise)
        let degrees = this.radiansToDegrees(radians)
        if (degrees < 0){
            degrees += 360;
        }
        //will this result in horrible floating pointyness?
        // degrees = Math.round(degrees*10)/10;
        return degrees.toFixed(1);
    }

    missileAimLoop(){
        if(!this.mouseDown){
            return;
        }
        let currentAngleString = this.fireControlAngleInput.value;
        let mousePosWorld = this.renderer.liveViewports[0].translateFromPixelToWorld(this.mousePos);
        let angleRad = this.firingPlayer.ship.position.angleTo(mousePosWorld);
        let newAngleString = this.tidyAngle(angleRad);
        if (newAngleString != currentAngleString){
            this.drawAimRecepticle(this.firingPlayer, parseFloat(newAngleString));
            this.fireControlAngleInput.value = newAngleString;
        }
        console.log(`mousePos: ${this.mousePos}, mousePosWorld: ${mousePosWorld}, newangle: ${newAngleString}`)


    }

    planMoveStage2(player, action){
        this.actionChooserDiv.classList.add("hidden");
        console.log(`player: ${player} ${action}`);
        switch(action){
            case "missile":
                this.aimMissile(player);
                
            break;
        }
    }

    runSimulation(){
        this.lastUpdateTime = performance.now();
        //dim the old trails a bit
        this.renderer.dimTrails();
        setTimeout(this.updateSimulation.bind(this), this.delay_ms)
    }

    allMissilesFinished(){
        this.simulationFinishedCallback();
    }

    updateSimulation(){
        let now = performance.now();
        let actualTimePassed_ms = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        // console.log(`Actual time passed: ${actualTimePassed_ms}ms`)
        for(let i =0; i<Math.floor(actualTimePassed_ms/this.physicsSteps_ms);i++){
            this.world.physics.update(this.simulationSpeed*this.physicsSteps_ms/1000, i==0);
        }
        this.renderer.renderAllLiveViewports();
        if (this.world.getLiveMissileCount() > 0){
            // carry on running simulation
            setTimeout(this.updateSimulation.bind(this), this.delay_ms)
        }else{
            //all missiles hit something
            this.allMissilesFinished()
        }
    }
}