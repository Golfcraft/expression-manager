# @ohmyverse/expression-manager
## A library to manage and react to javascript expression evaluations


```js
import { createExpressionManager, EVENT } from '@ohmyverse/expression-manager'

const em = createExpressionManager({ a: 1, b: 2 }, { context: { giveMeFive: () => 5 } })
const control1 = em.addControl({ id: 1, runtime: { storage: 'a' } })
const control2 = em.addControl({ id: 2, runtime: { anyExpressionToRead: 'a + c || a && b' } })
em.addRuntimeAssignment({
    storage: 'c',
    expression: 'a + b + giveMeFive()'
})
em.onEvent(({ data, type }: any) => {
    if (type === EVENT.EVENT_VARIABLE_CHANGE) {
        const { targetControlIds, newValues, oldValues } = data
        //changed variables from {"a":1}  to  {"c":10,"a":3}  affects the controls : [2, 1]
        log('changed variables from', JSON.stringify(oldValues), ' to ', JSON.stringify(newValues), ' affects the controls :', targetControlIds)
    }
})
log('state before interacting with control1', em.getState()) //returns {a: 1, b: 2}
control1.setValue(3)
log('state after interacting with control1', em.getState()) //returns {a: 3, b: 2, c: 10}
log("control2 value", control2.evaluate("anyExpressionToRead")); // logs: 13
```
####  (For more examples look src/index.test.ts, or see use case at Golfcraft map editor: https://www.youtube.com/watch?v=dSRqDn2JXxM&list=PLsGY7yOl-15QdZyFQZGET5Qc3rBBpHAyg&index=2)
Note that there is still missing options to document, we will be adding more documentation for runtime assignments like `timeout`, `condition`, `listen`, which are not explained in the example or tests for now. We are using this util internally but we don't have some much time to work on this project, any contribution is welcome.

## License

AGPL-3.0

If you need a different license for your company contact ohmyverse.io
