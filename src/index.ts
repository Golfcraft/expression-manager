import { createState } from "./state";
import Jsep from "jsep";
import { evaluate } from "./jsep-eval";
import seedrandom = require('seedrandom');

export type RuntimeAssignmentParams = {
    storage,
    expression,
    listen?,
    condition?,
    timeout?
};
export enum EVENT {
    EVENT_VARIABLE_CHANGE
}

const createExpressionStorage = ( initialState: any, initialAssignments?:any)=>{
    const defaultContext = {
        getRandomInt:(min,max, noSeed)=>getRandomInt(min, max, noSeed),
        now:()=>Date.now(),
        initialized:false
    };
    let seedRandom = seedrandom(initialState.seed, {});


    const store = createState(initialState);
    const callbacks = {
        onEvent: []
    };
    const variableControlReadLinksMap = {};
    const assignmentDependencies = {};
    const DEFAULT_ACC_EVENT =()=>({
        targetControlIds:[],
        newValues:{},
        oldValues:{}
    });
    const state = {
        accEvent:DEFAULT_ACC_EVENT()
    };

    store.onChange(({newValue, oldValue, prop})=>{
        const delayedAssignments = [];
        applyVariableAssignmentFromVariableName(prop);
        const targetControlIds = Array.from(new Set( [
            ...(variableControlReadLinksMap[prop]||[]).map(c=>c.id),
            ...getControlsAffectedByAssignmentTo(prop).map(c=>c.id)
        ] ));
        state.accEvent.targetControlIds = Array.from(new Set([...state.accEvent.targetControlIds, ...targetControlIds]));//TODO can be optimized if necessary
        state.accEvent.newValues[prop] = newValue;
        state.accEvent.oldValues[prop] = oldValue;
        if(delayedAssignments){
            delayedAssignments.forEach((delayedAssignment)=>{
                const [fn,assignment] = delayedAssignment;
                const {timeout,condition} = assignment;

                //TODO review if it would be better to define a setState wrapper function that does the joinEvent inside
                setTimeout(()=>{
                    if(condition && evaluateExpression(condition)){
                        joinEvent(fn, true);
                    }else if(!condition){
                        joinEvent(fn, true);
                    }

                }, timeout);
                removeValueFromArray(delayedAssignments, delayedAssignment)
            });
        }

        function applyVariableAssignmentFromVariableName(listenVariable){
            const assignmentsMap = assignmentDependencies[listenVariable]||{};
            Object.keys(assignmentsMap).forEach((assignmentStorageName)=>{
                const assignment = assignmentsMap[assignmentStorageName];
                if(assignment.timeout){
                    delayedAssignments.push([applyEvaluation, assignment]);
                }else{
                    applyEvaluation();
                }
                function applyEvaluation(){
                    if(assignment.condition){
                        const conditionResult = evaluateExpression(assignment.condition);

                        if(conditionResult){
                            store.setState({[assignmentStorageName]:evaluateExpression( assignment.expression )})
                        }
                    }else{
                        store.setState({[assignmentStorageName]:evaluateExpression( assignment.expression )})
                    }
                }
            });
        }
    });

    if(initialAssignments){
        const initializationState = Object.keys(initialAssignments).reduce((acc, variableName) => {
            const evaluation = evaluateExpression(initialAssignments[variableName]);
            acc[variableName] = evaluation;
            return acc;
        }, {});
        store.setState(initializationState);
    }

    function getRandomInt(min, max, avoidDefaultSeedOrSeed?){
        if(avoidDefaultSeedOrSeed !== undefined && avoidDefaultSeedOrSeed !== true){
            return min + Math.floor(seedrandom(avoidDefaultSeedOrSeed, {})() * (max - min + 1));
        }
        const result = avoidDefaultSeedOrSeed
            ? min + Math.floor(Math.random() * (max - min + 1))
            :min + Math.floor(seedRandom() * (max - min + 1));
        return result;
    }

    function getControlsAffectedByAssignmentTo(changedVariableName){//TODO optimize?
        const changedStorages = Object.keys(assignmentDependencies[changedVariableName]||{});

        return changedStorages.flat().map(storage=>variableControlReadLinksMap[storage]).flat().filter(i=>i);
    }

    function joinEvent(fn, isDelayed?){
        state.accEvent = DEFAULT_ACC_EVENT();
        fn();
        callbacks.onEvent.forEach(fn=>{
            fn({
                type:EVENT.EVENT_VARIABLE_CHANGE,
                data:{
                    ...state.accEvent,
                    isDelayed:!!isDelayed,
                }
            })
        })
    }


    return {
        addControl: (({id, runtime, defaultValue})=>{
            const storage = runtime.storage;
            const expressionsToListen:string[] = Object.values(runtime).filter(i=>i) as string[];
            const variableNames = expressionsToListen.map(e=> getVariablesFromNode([], Jsep(e))).flat();
            const control = {
                id,
                runtime,
                setValue:storage && ((value) => {
                    joinEvent(()=>store.setState({[storage]:value}));
                }),
                evaluate:(prop)=>{
                    if(!prop){
                        return storage && store.getState()[storage]//:evaluateExpression(read)
                    }else{
                        return evaluateExpression(runtime[prop], store.getState());
                    }
                }
            };
            variableNames.forEach((variableName) => {
                variableControlReadLinksMap[variableName] = variableControlReadLinksMap[variableName] || [];
                if(variableControlReadLinksMap[variableName].indexOf(control) === -1){
                    variableControlReadLinksMap[variableName].push(control);
                }
            });
            return control;

        }),
        addRuntimeAssignment: ({storage, expression, listen, timeout,condition}:RuntimeAssignmentParams) => {
            const variableNamesToListen = listen ? [...listen.split(",").map(l=>l.trim())] : (getVariablesFromNode([], Jsep(expression))||[]);
            variableNamesToListen.forEach((listenVariable)=>{
                assignmentDependencies[listenVariable] = assignmentDependencies[listenVariable] || {};
                assignmentDependencies[listenVariable][storage] = {storage, expression, listen, timeout, condition};
            });
        },
        setState: (value) => joinEvent(()=>store.setState(value)),
        getState: () => store.getState(),
        onEvent: (fn) => {
            callbacks.onEvent.push(fn);
            return ()=>callbacks.onEvent.splice( callbacks.onEvent.indexOf(fn) ,1);
        },
        dispose: () => {

        }
    };

    function evaluateExpression(expression, context = store.getState()){
        const result =evaluate(expression, {...defaultContext, ...context});
        return result;
    }
}

const evaluateExpression = evaluate;

export {
    createExpressionStorage,
    evaluateExpression
};
export function getVariablesFromExpression(expression){

    return getVariablesFromNode([], Jsep(expression));
}
function getVariablesFromNode(acc, node){
    if(node.type === "Identifier"){
        return [...acc, node.name];
    }else if(node.argument){
        return [...acc, ...node.argument.type === "Identifier" && getVariablesFromNode(acc, node.argument) ||[]];
    }else if(node.operator){
        return [
            ...node.left.type !== "Literal" && getVariablesFromNode(acc, node.left)||[],
            ...node.right.type !== "Literal" && getVariablesFromNode(acc, node.right)||[]];
    }else if(node.CallExpression){
        return [...(node.arguments.map(a=>getVariablesFromNode(acc, a)).flatMap())];
    }
}

function removeValueFromArray(array, value){
    const index = array.indexOf(value);
    array.splice(index, 1);
    return ~index;
}