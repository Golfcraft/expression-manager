/**
 * MIT License
 * Copyright (c) 2018 Sensative AB

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */
//
// evaluates javascript expression statements parsed with jsep
//

import Jsep from 'jsep';


const operators = {
  binary: {
    '===': (a, b) => (a === b),
    '!==': (a, b) => (a !== b),
    '==': (a, b) => (a == b), // eslint-disable-line
    '!=': (a, b) => (a != b), // eslint-disable-line
    '>': (a, b) => (a > b),
    '<': (a, b) => (a < b),
    '>=': (a, b) => (a >= b),
    '<=': (a, b) => (a <= b),
    '+': (a, b) => (a + b),
    '-': (a, b) => (a - b),
    '*': (a, b) => (a * b),
    '/': (a, b) => (a / b),
    '%': (a, b) => (a % b), // remainder
    '**': (a, b) => (a ** b), // exponentiation
    '&': (a, b) => (a & b), // bitwise AND
    '|': (a, b) => (a | b), // bitwise OR
    '^': (a, b) => (a ^ b), // bitwise XOR
    '<<': (a, b) => (a << b), // left shift
    '>>': (a, b) => (a >> b), // sign-propagating right shift
    '>>>': (a, b) => (a >>> b), // zero-fill right shift
    // Let's make a home for the logical operators here as well
    '||': (a, b) => (a || b),
    '&&': (a, b) => (a && b),
  },
  unary: {
    '!': a => !a,
    '~': a => ~a, // bitwise NOT
    '+': a => +a, // unary plus
    '-': a => -a, // unary negation
    '++': a => ++a, // increment
    '--': a => --a, // decrement
  },
};

const types = {
  // supported
  LITERAL: 'Literal',
  UNARY: 'UnaryExpression',
  BINARY: 'BinaryExpression',
  LOGICAL: 'LogicalExpression',
  CONDITIONAL: 'ConditionalExpression',  // a ? b : c
  MEMBER: 'MemberExpression',
  IDENTIFIER: 'Identifier',
  THIS: 'ThisExpression', // e.g. 'this.willBeUsed'
  CALL: 'CallExpression', // e.g. whatcha(doing)
  ARRAY: 'ArrayExpression', // e.g. [a, 2, g(h), 'etc']
  COMPOUND: 'Compound' // 'a===2, b===3' <-- multiple comma separated expressions.. returns last
};
const undefOperator = () => undefined;

const getParameterPath = (node, context) => {
  assert(node, 'Node missing');
  const type = node.type;
  assert(Object.values(types).includes(type), 'invalid type '+type);
  assert([types.MEMBER, types.IDENTIFIER].includes(type), 'Invalid parameter path node type: '+type);
  // the easy case: 'IDENTIFIER's
  if (type === types.IDENTIFIER) {
    return node.name;
  }
  // Otherwise it's a MEMBER expression
  // EXAMPLES:  a[b] (computed)
  //            a.b (not computed)
  const computed = node.computed;
  const object = node.object;
  const property = node.property;
  // object is either 'IDENTIFIER', 'MEMBER', or 'THIS'
  assert([types.MEMBER, types.IDENTIFIER, types.THIS].includes(object.type), 'Invalid object type');
  assert(property, 'Member expression property is missing');

  let objectPath = '';
  if (object.type === types.THIS) {
    objectPath = '';
  } else {
    objectPath = node.name || getParameterPath(object, context);
  }

  if (computed) {
    // if computed -> evaluate anew
    const propertyPath = evaluateExpressionNode(property, context);
    return objectPath + '[' + propertyPath + ']';
  } else {
    assert([types.MEMBER, types.IDENTIFIER].includes( property.type), 'Invalid object type');
    const propertyPath = property.name || getParameterPath(property, context);
    return (objectPath ? objectPath + '.': '') + propertyPath;
  }
};

const evaluateExpressionNode = (node, context) => {
  assert(node, 'Node missing');
  assert(Object.values(types).includes(node.type), "invalid node type", node );
  switch (node.type) {
    case types.LITERAL: {
      return node.value;
    }
    case types.THIS: {
      return context;
    }
    case types.COMPOUND: {
      const expressions = node.body.map(el => evaluateExpressionNode(el, context));
      return expressions.pop();
    }
    case types.ARRAY: {
      return node.elements.map(el => evaluateExpressionNode(el, context));
    }
    case types.UNARY: {
      const operator = operators.unary[node.operator] || undefOperator;
      assert(operators.unary[operator], 'Invalid unary operator');
      const argument = evaluateExpressionNode(node.argument, context);
      return operator(argument);
    }
    case types.LOGICAL: // !!! fall-through to BINARY !!! //
    case types.BINARY: {
      const operator = operators.binary[node.operator] || undefOperator;
      assert(operators.binary[operator], 'Invalid binary operator');
      const left = evaluateExpressionNode(node.left, context);
      const right = evaluateExpressionNode(node.right, context);
      return operator(left, right);
    }
    case types.CONDITIONAL: {
      const test = evaluateExpressionNode(node.test, context);
      const consequent = evaluateExpressionNode(node.consequent, context);
      const alternate = evaluateExpressionNode(node.alternate, context);
      return test ? consequent : alternate;
    }
    case types.CALL : {
      assert([types.MEMBER, types.IDENTIFIER, types.THIS].includes(node.callee.type), 'Invalid function callee type');
      const callee = evaluateExpressionNode(node.callee, context);
      const args = node.arguments.map(arg => evaluateExpressionNode(arg, context));
      return callee.apply(null, args);
    }
    case types.IDENTIFIER: // !!! fall-through to MEMBER !!! //
    case types.MEMBER: {
      const path = getParameterPath(node, context);
      return _get(context, path);
    }
    default:
      return undefined;
  }
};

const evaluate = (expression, context) => {
  const tree = Jsep(expression);
  return evaluateExpressionNode(tree, context);
};

// is just a promise wrapper
const peval = (expression, context) => {
  return Promise.resolve()
    .then(() => evaluate(expression, context));
};

export {
  evaluate,
  peval,
  types,
  operators
};

function assert(value, errorMsg, errorArgs?){
  if(value === undefined) return;
  if(!!value) return;
  if(!value){
    console.error(errorMsg, errorArgs);
    throw Error(errorMsg);
  }
}

function _get( object, keys, defaultVal? ){
  keys = Array.isArray( keys )? keys : keys.split('.');
  object = object[keys[0]];
  if( object && keys.length>1 ){
    return _get( object, keys.slice(1) );
  }
  return object === undefined? defaultVal : object;
}