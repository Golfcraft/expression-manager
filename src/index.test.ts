import chai from 'chai';
const {expect, use, assert, should} = chai;
import spies from "chai-spies";
use(spies);
const {sandbox, on, restore, returns} = spies;
const spy = chai["spy"];

import { EVENT } from './index';
import {createExpressionManager} from "./index";

describe("ExpressionStorage", () => {
    let eStorage;

    beforeEach(()=>{
        eStorage = createExpressionManager({a:1});
    });

    it("should allow to create an storage with an initial state", () => {
        expect(eStorage.getState()).to.deep.equal({a:1});       
    });

    describe("getState", ()=>{
        
    });

    describe("setState", () => {
        it("must extend state object", () => {

        });
    });

    describe("addControl", ()=>{
        describe("with read property", ()=>{

            it("should trigger an event with the control listed on it when value is changed", ()=>{                
                const control = eStorage.addControl({
                    id:0,
                    runtime:{read:"a"}
                });
                  
                let eventType;
                let eventData;

                eStorage.onEvent(({type, data})=>{
                    eventType = type;
                    eventData = data;
                });

                eStorage.setState({a:2});

                expect(eventType).to.equal(EVENT.EVENT_VARIABLE_CHANGE);
                expect(eventData).to.deep.equal({
                    targetControlIds:[control.id],
                    newValues:{
                        a:2
                    },
                    oldValues:{
                        a:1
                    }
                }); 
            });
        });
    });

    describe("with several read controls", () => {
        it("", ()=>{
            const control = eStorage.addControl({
                id:0,
                runtime:{read:"a"}
            });
            const control2 = eStorage.addControl({
                id:1,
                runtime:{read:"a && b"}
            });
            const control3 = eStorage.addControl({
                id:1,
                runtime:{read:"b"}
            });
            let eventType;
            let eventData;

            eStorage.onEvent(({type, data})=>{
                eventType = type;
                eventData = data;
            });

            eStorage.setState({a:2});
           
            expect(eventData).to.deep.equal({
                targetControlIds:[control.id, control2.id],
                newValues:{
                    a:2
                },
                oldValues:{
                    a:1
                }
            });
            expect(eventType).to.equal(EVENT.EVENT_VARIABLE_CHANGE);
        })
    });

    describe("with write control", ()=>{
        it("should work", ()=>{
            eStorage.setState({b:2});
            const controlRead = eStorage.addControl({
                id:0,
                runtime:{read:"a + b"}
            });
            const controlWrite = eStorage.addControl({
                id:1,
                runtime:{storage:"a"}
            });

            expect(controlRead.evaluate("read")).to.eq(3);
            expect(controlWrite.evaluate()).to.eq(1);

               
            let eventType;
            let eventData;
            eStorage.onEvent(({type, data})=>{
                eventType = type;
                eventData = data;
            });

            controlWrite.setValue(2); 

            expect(controlRead.evaluate("read")).to.eq(4);
            expect(controlWrite.evaluate()).to.eq(2);
            expect(eventType).to.equal(EVENT.EVENT_VARIABLE_CHANGE);
            expect(eventData).to.deep.equal({            
                targetControlIds:[controlRead.id, controlWrite.id],
                newValues:{
                    a:2
                },
                oldValues:{
                    a:1
                }
            });  
        });
    })

    describe("addRuntimeAssignment", () => {
        beforeEach(()=>{
            eStorage = createExpressionManager({});
        });

        it("should have expression evaluated after adding assignment and set control value", ()=>{
            const button1 = eStorage.addControl({
                id:1,
                runtime:{ storage:"button1"}
            });
            const button2 = eStorage.addControl({
                id:2,
                runtime:{storage:"button2"}
            });
            eStorage.addRuntimeAssignment({
                storage:"button2",
                expression:"!button1"
            });
            button1.setValue(false);
            expect(button2.evaluate()).to.equal(true)
        });
        it("should have expression evaluated after adding assignment and set control value", ()=>{
            const button1 = eStorage.addControl({
                id:1,
                runtime:{ storage:"button1"}
            });
            const button2 = eStorage.addControl({
                id:2,
                runtime:{storage:"button2"}
            });
            eStorage.addRuntimeAssignment({
                storage:"button2",
                expression:"button1 !== true"
            });
            button1.setValue(false);
            expect(button2.evaluate()).to.equal(true)
        });
        it("should dispatch event if storage values changes when added runtimeAssignment", ()=>{
            const button1 = eStorage.addControl({
                id:1,
                runtime:{storage:"button1"}
            });
            const button2 = eStorage.addControl({
                id:2,
                runtime:{storage:"button2"}
            });

            let eventType;
            let eventData;
            eStorage.onEvent(({type, data})=>{
                eventType = type;
                eventData = data;
            });
            eStorage.addRuntimeAssignment({
                storage:"button2",
                expression:"!button1"
            });
            button2.setValue(true);
            expect(eventType).to.equal(EVENT.EVENT_VARIABLE_CHANGE);
            expect(eventData).to.deep.equal({            
                targetControlIds:[button2.id],
                newValues:{
                    button2:true
                },
                oldValues:{
                    button2:undefined
                }
            });  
        });




    });
    describe("door and 2 buttons", () => {
        let lastEvent;
        let door, button1, button2, eventSpy = spy((event)=>{
            
            lastEvent = event;
        });
        beforeEach(()=>{  
            eStorage = createExpressionManager({});     
            eStorage.onEvent(eventSpy);  

   
            door = eStorage.addControl({
                id:0,
                runtime:{read:"button1 && button2"}
            });
            button1 = eStorage.addControl({
                id:1,
                runtime:{storage:"button1"}
            });
            button2 = eStorage.addControl({
                id:2,
                runtime:{storage:"button2"}
            });
            eStorage.addRuntimeAssignment({
                storage:"button2",
                expression:"!button1"
            });
            console.log("---------------------")
           
        });

        it("inital state and event", ()=>{
            button2.setValue(true);
            expect(eventSpy).to.have.been.called.once;
            expect(lastEvent).to.deep.equal({
                type:EVENT.EVENT_VARIABLE_CHANGE,
                data:{
                    targetControlIds:[door.id, button2.id],
                    newValues:{
                        button2:true
                    },
                    oldValues:{
                        button2:undefined
                    }
                }
            });
            expect(eStorage.getState()).to.deep.equal({
                button2:true
            });

        });


        it("state after interaction button2 and button1", ()=>{
            button2.setValue(true );
            expect(eStorage.getState()).to.deep.equal({
                button2:true
            });
            expect(button1.evaluate()).to.equal(undefined);
            expect(button2.evaluate()).to.equal(true);
            expect(!!door.evaluate("read")).to.equal(false);

            button2.setValue( !button2.evaluate() );
             
            expect(button1.evaluate()).to.equal(undefined);
            expect(button2.evaluate()).to.equal(false);
            expect(!!door.evaluate("read")).to.equal(false);
            expect(eStorage.getState()).to.deep.equal({
                button2:false                
            });        

            button1.setValue( !button1.evaluate() );
            
            expect(button1.evaluate()).to.equal(true);
            expect(button2.evaluate()).to.equal(false);
            expect(door.evaluate("read")).to.equal(false);
            expect(eStorage.getState()).to.deep.equal({
                button1:true,
                button2:false                
            });   

            button2.setValue( !button2.evaluate() );

            expect(button1.evaluate()).to.equal(true);
            expect(button2.evaluate()).to.equal(true);
            expect(door.evaluate("read")).to.equal(true);
            expect(eStorage.getState()).to.deep.equal({
                button1:true,
                button2:true
            });
        });

        
    });

    describe("default context functions", ()=>{
        describe("getRandomInt(min,max)", ()=>{
            it("should evaluate a random seed and give different result on sequential calls", ()=>{
                const rt = createExpressionManager({seed:0.1});

                const control = rt.addControl({
                    id:1,
                    runtime:{
                        read:"getRandomInt(0,10)"
                    },defaultValue:undefined
                });
                expect(control.evaluate("read")).to.equal(10);
                expect(control.evaluate("read")).to.equal(4);
            })
        });

        describe("now()", ()=>{
           it("should return current datetime", ()=>{
               const rt = createExpressionManager({});
               const control = rt.addControl({
                   id:1,
                   runtime:{
                       read:"now()"
                   },defaultValue:undefined
               });

               expect(control.evaluate("read")).to.equal(Date.now());
           })
        });
    });
});