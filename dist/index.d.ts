export declare const createExpressionManager: (initialState: any, { initialAssignments, context }?: any) => {
    addControl: ({ id, runtime, defaultValue }: {
        id: any;
        runtime: any;
        defaultValue?: any;
    }) => {
        id: any;
        runtime: any;
        setValue: (value: any) => void;
        evaluate: (prop: any) => any;
    };
    addRuntimeAssignment: ({ storage, expression, listen, timeout, condition }: RuntimeAssignmentParams) => void;
    setState: (value: any) => void;
    getState: () => any;
    onEvent: (fn: any) => () => any[];
    dispose: () => void;
};

export declare enum EVENT {
    EVENT_VARIABLE_CHANGE = 0
}

export declare function getVariablesFromExpression(expression: any): any;

export declare type RuntimeAssignmentParams = {
    storage: any;
    expression: any;
    listen?: any;
    condition?: any;
    timeout?: any;
};

export { }
