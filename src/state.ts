export interface State<T> {
    getState:()=>T,
    setState:Function,
    onChange:Function,
    dispose:Function
};

/**
 * Naive state manager approach with subscription, 1 level state key/value
 */
 const createState = (initialState) => {
    const state = {...initialState};
    const subs:{onChange:Map<string|undefined, Set<Function>>} = {
        onChange:new Map()
    };
    const stateP = new Proxy(state, {
        set:(obj, prop, value) => {
            let oldValue = obj[prop];
            if(oldValue === value) return true;
            const triggerCallback = (callback)=>{
                callback({
                    newValue:value,
                    oldValue,
                    prop
                });
            };
            obj[prop] = value;
            subs.onChange.get(prop as string)?.forEach(triggerCallback);
            subs.onChange.get(undefined)?.forEach(triggerCallback);
            
            return true;
        }
    });

    const onChange = (callback:Function, keyProp?:string) => {
        if(!subs.onChange.has(keyProp)) subs.onChange.set(keyProp, new Set());
        subs.onChange.get(keyProp)?.add(callback);

        return () => {            
            subs.onChange.get(keyProp)?.delete(callback);            
        }
    };

    return {
        setState:(value)=>{
            Object.assign(stateP, value);
        },
        getState:()=>stateP,
        onChange,
        dispose:()=>{
            subs.onChange.clear();
        }
    };
}

export {
    createState
};