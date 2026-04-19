class PlanetWarsEventListener{
    constructor(eventType, callback){
        //string or null if you want every event
        this.eventType = eventType;
        // (event) => {}
        this.callback = callback;
    }
}

export class PlanetWarsEventSource{

    constructor(){
        this.eventListeners = [];
    }

    eventOccured(eventType, info){
        for(const listener of this.eventListeners){
            if (listener.eventType == eventType){
                listener.callback(info);
            }
            if(listener.eventType == null){
                //special case. unsure if this is a good idea or not. Is a different list of global listeners a better idea?
                //pretty sure this will only be used for Game to listen to World events
                listener.callback(eventType, info);
            }
        }
    }

    removeEventListener(eventListener){
        const index = this.eventListeners.indexOf(eventListener);
        if(index >= 0){
            this.eventListeners.splice(index, 1);
            return true;
        }else{
            console.log("Can't remove event listener, not found")
        }
        return false;
    }

    /**
     * Add a callback that will be called when eventType occurs.
     * Returns an object which can be used to later remove the listener
     * @param {*} eventType 
     * @param {*} callback 
     * @returns 
     */
    addEventListener(eventType, callback){
        let newListener = new PlanetWarsEventListener(eventType, callback)
        this.eventListeners.push(newListener);
        return newListener;
    }
}