import { WorldRenderer, Viewport } from "./render.js";
import { World } from "./world.js";
import { polar, Vector } from "./geometry.js";
import { PlanetWarsEventSource } from "./events.js";


export class Player{
    constructor(index, name = "Unnamed Player", shields=3){
        this.index = index;
        this.name = name;
        this.ship = null;
        this.shields = shields;
        this.previousShotsDegrees = [];
    }

    isAlive(){
        return this.ship.alive;
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

/**
 * Existing events:
 * simulationFinished, {
            "survivors": this.getLivePlayerIndexes(),
            "gameOver": this.isGameOver()
        };

    actionChosen, {
            "action": "Fire", "Shield"
            "angle": angleRads
        }
 */

/**
 * Longer term plan: add an events system to World, then augment it with events from here too, then things can subscribe to specific events
 * rather than having lots and lots of callbacks.
 */
export class PlanetWarsMatch extends PlanetWarsEventSource{
    /**
     * Idea - this will perform some of the UI interactions so there isn't too much of that (or ideally any) in the PlanetWarsSocketClient
     * This can be shared between multiplayer and debug
     * this will provide a (hopefully) clean API that the multiplayer can interact with.
     */
    constructor(mainGameDiv, players){
        super();
        this.mainGameDiv = mainGameDiv;
        //TODO make this element by element? then dispense with teh queryselectors below.
        this.mainGameDiv.innerHTML=`<h2 id="player_info"></h2>
    <h3 id="game_status"></h3>
    <div class="hidden" id="action_chooser"></div>
    <div class="hidden" id="fire_control">
        <form>
            <input type="text" name="angle">
            <input type="submit" value="Fire!">
        </form>
    </div>
    <div class="canvas_container">
        <canvas id="background" class="circle" width="800" height="800" ></canvas>
        <canvas id="occasional_changes" class="circle" width="800" height="800" ></canvas>
        <canvas id="missile_trails" class="circle" width="800" height="800" ></canvas>
        <canvas id="live" class="circle" width="800" height="800" ></canvas>
    </div>`


        this.actionChooserDiv = mainGameDiv.querySelector("#action_chooser");
        this.fireControlDiv = mainGameDiv.querySelector("#fire_control");

        this.fireControlForm = this.fireControlDiv.querySelector("form")

        this.fireControlAngleInput = this.fireControlForm.querySelector("input[name='angle']")

        this.backgroundCanvasElement = mainGameDiv.querySelector("#background");
        // ships and shields and things which don't change often - changed my mind and will just redraw the background
        // this.occasionalChangesCanvasElement = mainGameDiv.querySelector("#occasional_changes");
        this.missileTrailCanvasElement =  mainGameDiv.querySelector("#missile_trails");
        this.liveCanvasElement =  mainGameDiv.querySelector("#live");

        this.world = null;
        this.renderer = null;
        this.players = players;
        // fired a missile, or brought up shields, etc
        this.playerChosenActionCallback = (actionInfo)=>{
            // console.log(`Fire missile ${player.index}: ${this.radiansToDegrees(angleRadians)}`)
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

    // shipHit(hit, hitBy){
    //     this.players[hit.playerIndex].alive = false;

    // }


    setPlayerChosenActionCallback(callback){
        this.playerChosenActionCallback = callback;
    }

    setSimulationFinishedCallback(callback){
        this.simulationFinishedCallback = callback
    }

    isGameOver(){
        return this.world.getLivePlayerCount() <= 1;
    }

    getLivePlayerIndexes(){
        let players = [];
        for(const ship of this.world.ships){
            if (ship.alive){
                players.push(ship.playerIndex)
            }
        }
        return players;
    }

    newRound(seed){
        let radius = 400;
        if (this.players.length > 4){
            radius = 500;
        }
        this.world = new World(this.players.length, seed, radius);
        this.renderer = new WorldRenderer(seed, this.world);

        let canvas_size = parseInt(this.backgroundCanvasElement.width);
        let zoom = (canvas_size/2)/this.world.radius

        this.renderer.addBackgroundViewport(new Viewport(new Vector(0,0), zoom, this.backgroundCanvasElement.getContext("2d"), canvas_size, canvas_size))
        let missileTrailsViewPort = new Viewport(new Vector(0,0), zoom, this.missileTrailCanvasElement.getContext("2d"), canvas_size, canvas_size);
        let missileViewPort = new Viewport(new Vector(0,0), zoom, this.liveCanvasElement.getContext("2d"), canvas_size, canvas_size);
        this.renderer.addLiveViewport(missileViewPort);
        this.renderer.addTrailsViewport(missileTrailsViewPort)
        
        this.renderer.renderBackground()

        for(let i =0; i<this.players.length; i++){
            this.players[i].setShip(this.world.ships[i]);
        }

        this.world.addEventListener(null, this.worldEvent.bind(this));

        console.log(`New round: zoom ${zoom}, world radius: ${radius}, canvas_size: ${canvas_size}`)
    }

    /**
     * listener for any events produced from the World, probably while simulations occuring.
     * planning to use this for dealing with powerups and animations
     * @param {*} eventType 
     * @param {*} info 
     */
    worldEvent(eventType, info){
        //parrot it out to anything interested (probably the animation system when it exists)
        this.eventOccured(eventType, info);
    }

    provideActionTypeChoice(player){
        //provide options
        this.actionChooserDiv.classList.remove("hidden");
        this.actionChooserDiv.innerHTML="Choose Move:"
        let actions = player.getAvailableActions();
        if(actions.length == 1 && actions[0] == "missile"){
            //skip the options and go straight to aiming
            this.actionChosen(player, actions[0]);
        }
        for (const action of actions){
            let button = document.createElement("button");
            let text = action;
            if(action == "shield"){
                text = `Use Shield (${player.shields} remaining)`;
            }
            if(action == "missile"){
                text = "Fire Missile (unlimited)";
            }
            button.value=action;
            button.innerHTML = text;
            button.onclick=() =>{
                this.actionChosen(player, action);
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
            this.playerFiresMissile();
            return false;
        }



        this.firingPlayer = player;
        this.mouseDown = false;
        this.mousePos = new Vector(0,0);
        this.aimingInterval = setInterval(this.missileAimLoop.bind(this), 50);

        this.missileAimLoop();

        this.liveCanvasElement.onmousedown=(e)=>{this.mouseDown = true;}
        document.onmouseup = (e) => {this.mouseDown = false;}
        document.onmousemove = (e) => {
            let rect = this.liveCanvasElement.getBoundingClientRect();
            let x = e.clientX - rect.left; //x position within the element.
            let y = e.clientY - rect.top;  //y position within the element.
            this.mousePos = new Vector(x,y);
        };
        // no mouse on mobile, so a bodgey backup with click
        this.liveCanvasElement.onclick=(e) => {
            let rect = this.liveCanvasElement.getBoundingClientRect();
            let x = e.clientX - rect.left; //x position within the element.
            let y = e.clientY - rect.top;  //y position within the element.
            this.mousePos = new Vector(x,y);
            this.mouseDown = true;
            this.missileAimLoop();
            this.mouseDown = false;
        };

        this.fireControlAngleInput.addEventListener("input", (event)=>{
            this.drawAimRecepticle(this.firingPlayer, event.target.value)
        })
    }

    

    /**
     * For multiplayer, or something else controlling this object to choose to use user input to launch a missile
     * @param {*} player 
     * @param {*} angleRadians 
     */
    shipFiresMissile(player, angleRadians){
        this.world.fireMissileAtAngle(player.index, angleRadians);
        //redraw background as the ship will have changed angle
        this.renderer.renderBackground();
    }

    shipUsesShield(player, shieldType){
        this.world.useShield(player.index, true, shieldType);
        player.shields--;
        this.renderer.renderBackground();
    }

    //disable sheilds and anything else that lasts only one turn
    shipLosesTemporaryEffects(player){
        this.world.useShield(player.index, false);
        this.renderer.renderBackground();
    }

    loseAllTemporaryEffects(){
        for(const player of this.players){
            this.shipLosesTemporaryEffects(player);
        }
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
        // console.log(`mousePos: ${this.mousePos}, mousePosWorld: ${mousePosWorld}, newangle: ${newAngleString}`)


    }

    /**
     * End result of choosing to fire a missile
     * Intended to be called from the UI after aimMissile()
     * just fires off a callback and tidies up the redraw loop from aiming
     */
    playerFiresMissile(){
        //TODO also remove event listeners?
        clearInterval(this.aimingInterval);

        this.fireControlDiv.classList.add("hidden");

        let angleRads = this.degreesToRadians(parseFloat(this.fireControlAngleInput.value));
        this.firingPlayer.previousShotsDegrees.push(this.fireControlAngleInput.value)
        let info = {
            "action": "Fire",
            "angle": angleRads
            
        }
        //clear the aiming doodad
        this.renderer.liveViewports[0].clear();
        this.playerChosenActionCallback(info);
        this.eventOccured("actionChosen", info);
    }

    actionChosen(player, action){
        this.actionChooserDiv.classList.add("hidden");
        console.log(`player: ${player} ${action}`);
        switch(action){
            case "missile":
                this.aimMissile(player);
                
            break;
            case "shield":
                let info = {
                    "action": "Shield",            
                };
                this.playerChosenActionCallback();
                this.eventOccured("actionChosen", info);
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
        let info = {
            "survivors": this.getLivePlayerIndexes(),
            "gameOver": this.isGameOver()
        };
        this.eventOccured("simulationFinished", info);
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