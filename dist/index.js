define('@ohmyverse/expression-manager', ['exports'], (function (exports) { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    /**
     * Naive state manager approach with subscription, 1 level state key/value
     */
    var createState = function (initialState) {
        var state = __assign({}, initialState);
        var subs = {
            onChange: new Map()
        };
        var stateP = new Proxy(state, {
            set: function (obj, prop, value) {
                var _a, _b;
                var oldValue = obj[prop];
                if (oldValue === value)
                    return true;
                var triggerCallback = function (callback) {
                    callback({
                        newValue: value,
                        oldValue: oldValue,
                        prop: prop
                    });
                };
                obj[prop] = value;
                (_a = subs.onChange.get(prop)) === null || _a === void 0 ? void 0 : _a.forEach(triggerCallback);
                (_b = subs.onChange.get(undefined)) === null || _b === void 0 ? void 0 : _b.forEach(triggerCallback);
                return true;
            }
        });
        var onChange = function (callback, keyProp) {
            var _a;
            if (!subs.onChange.has(keyProp))
                subs.onChange.set(keyProp, new Set());
            (_a = subs.onChange.get(keyProp)) === null || _a === void 0 ? void 0 : _a.add(callback);
            return function () {
                var _a;
                (_a = subs.onChange.get(keyProp)) === null || _a === void 0 ? void 0 : _a["delete"](callback);
            };
        };
        return {
            setState: function (value) {
                Object.assign(stateP, value);
            },
            getState: function () { return stateP; },
            onChange: onChange,
            dispose: function () {
                subs.onChange.clear();
            }
        };
    };

    /**
     * @implements {IHooks}
     */
    class Hooks {
    	/**
    	 * @callback HookCallback
    	 * @this {*|Jsep} this
    	 * @param {Jsep} env
    	 * @returns: void
    	 */
    	/**
    	 * Adds the given callback to the list of callbacks for the given hook.
    	 *
    	 * The callback will be invoked when the hook it is registered for is run.
    	 *
    	 * One callback function can be registered to multiple hooks and the same hook multiple times.
    	 *
    	 * @param {string|object} name The name of the hook, or an object of callbacks keyed by name
    	 * @param {HookCallback|boolean} callback The callback function which is given environment variables.
    	 * @param {?boolean} [first=false] Will add the hook to the top of the list (defaults to the bottom)
    	 * @public
    	 */
    	add(name, callback, first) {
    		if (typeof arguments[0] != 'string') {
    			// Multiple hook callbacks, keyed by name
    			for (let name in arguments[0]) {
    				this.add(name, arguments[0][name], arguments[1]);
    			}
    		}
    		else {
    			(Array.isArray(name) ? name : [name]).forEach(function (name) {
    				this[name] = this[name] || [];

    				if (callback) {
    					this[name][first ? 'unshift' : 'push'](callback);
    				}
    			}, this);
    		}
    	}

    	/**
    	 * Runs a hook invoking all registered callbacks with the given environment variables.
    	 *
    	 * Callbacks will be invoked synchronously and in the order in which they were registered.
    	 *
    	 * @param {string} name The name of the hook.
    	 * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
    	 * @public
    	 */
    	run(name, env) {
    		this[name] = this[name] || [];
    		this[name].forEach(function (callback) {
    			callback.call(env && env.context ? env.context : env, env);
    		});
    	}
    }

    /**
     * @implements {IPlugins}
     */
    class Plugins {
    	constructor(jsep) {
    		this.jsep = jsep;
    		this.registered = {};
    	}

    	/**
    	 * @callback PluginSetup
    	 * @this {Jsep} jsep
    	 * @returns: void
    	 */
    	/**
    	 * Adds the given plugin(s) to the registry
    	 *
    	 * @param {object} plugins
    	 * @param {string} plugins.name The name of the plugin
    	 * @param {PluginSetup} plugins.init The init function
    	 * @public
    	 */
    	register(...plugins) {
    		plugins.forEach((plugin) => {
    			if (typeof plugin !== 'object' || !plugin.name || !plugin.init) {
    				throw new Error('Invalid JSEP plugin format');
    			}
    			if (this.registered[plugin.name]) {
    				// already registered. Ignore.
    				return;
    			}
    			plugin.init(this.jsep);
    			this.registered[plugin.name] = plugin;
    		});
    	}
    }

    //     JavaScript Expression Parser (JSEP) 1.3.7

    class Jsep {
    	/**
    	 * @returns {string}
    	 */
    	static get version() {
    		// To be filled in by the template
    		return '1.3.7';
    	}

    	/**
    	 * @returns {string}
    	 */
    	static toString() {
    		return 'JavaScript Expression Parser (JSEP) v' + Jsep.version;
    	};

    	// ==================== CONFIG ================================
    	/**
    	 * @method addUnaryOp
    	 * @param {string} op_name The name of the unary op to add
    	 * @returns {Jsep}
    	 */
    	static addUnaryOp(op_name) {
    		Jsep.max_unop_len = Math.max(op_name.length, Jsep.max_unop_len);
    		Jsep.unary_ops[op_name] = 1;
    		return Jsep;
    	}

    	/**
    	 * @method jsep.addBinaryOp
    	 * @param {string} op_name The name of the binary op to add
    	 * @param {number} precedence The precedence of the binary op (can be a float). Higher number = higher precedence
    	 * @param {boolean} [isRightAssociative=false] whether operator is right-associative
    	 * @returns {Jsep}
    	 */
    	static addBinaryOp(op_name, precedence, isRightAssociative) {
    		Jsep.max_binop_len = Math.max(op_name.length, Jsep.max_binop_len);
    		Jsep.binary_ops[op_name] = precedence;
    		if (isRightAssociative) {
    			Jsep.right_associative.add(op_name);
    		}
    		else {
    			Jsep.right_associative.delete(op_name);
    		}
    		return Jsep;
    	}

    	/**
    	 * @method addIdentifierChar
    	 * @param {string} char The additional character to treat as a valid part of an identifier
    	 * @returns {Jsep}
    	 */
    	static addIdentifierChar(char) {
    		Jsep.additional_identifier_chars.add(char);
    		return Jsep;
    	}

    	/**
    	 * @method addLiteral
    	 * @param {string} literal_name The name of the literal to add
    	 * @param {*} literal_value The value of the literal
    	 * @returns {Jsep}
    	 */
    	static addLiteral(literal_name, literal_value) {
    		Jsep.literals[literal_name] = literal_value;
    		return Jsep;
    	}

    	/**
    	 * @method removeUnaryOp
    	 * @param {string} op_name The name of the unary op to remove
    	 * @returns {Jsep}
    	 */
    	static removeUnaryOp(op_name) {
    		delete Jsep.unary_ops[op_name];
    		if (op_name.length === Jsep.max_unop_len) {
    			Jsep.max_unop_len = Jsep.getMaxKeyLen(Jsep.unary_ops);
    		}
    		return Jsep;
    	}

    	/**
    	 * @method removeAllUnaryOps
    	 * @returns {Jsep}
    	 */
    	static removeAllUnaryOps() {
    		Jsep.unary_ops = {};
    		Jsep.max_unop_len = 0;

    		return Jsep;
    	}

    	/**
    	 * @method removeIdentifierChar
    	 * @param {string} char The additional character to stop treating as a valid part of an identifier
    	 * @returns {Jsep}
    	 */
    	static removeIdentifierChar(char) {
    		Jsep.additional_identifier_chars.delete(char);
    		return Jsep;
    	}

    	/**
    	 * @method removeBinaryOp
    	 * @param {string} op_name The name of the binary op to remove
    	 * @returns {Jsep}
    	 */
    	static removeBinaryOp(op_name) {
    		delete Jsep.binary_ops[op_name];

    		if (op_name.length === Jsep.max_binop_len) {
    			Jsep.max_binop_len = Jsep.getMaxKeyLen(Jsep.binary_ops);
    		}
    		Jsep.right_associative.delete(op_name);

    		return Jsep;
    	}

    	/**
    	 * @method removeAllBinaryOps
    	 * @returns {Jsep}
    	 */
    	static removeAllBinaryOps() {
    		Jsep.binary_ops = {};
    		Jsep.max_binop_len = 0;

    		return Jsep;
    	}

    	/**
    	 * @method removeLiteral
    	 * @param {string} literal_name The name of the literal to remove
    	 * @returns {Jsep}
    	 */
    	static removeLiteral(literal_name) {
    		delete Jsep.literals[literal_name];
    		return Jsep;
    	}

    	/**
    	 * @method removeAllLiterals
    	 * @returns {Jsep}
    	 */
    	static removeAllLiterals() {
    		Jsep.literals = {};

    		return Jsep;
    	}
    	// ==================== END CONFIG ============================


    	/**
    	 * @returns {string}
    	 */
    	get char() {
    		return this.expr.charAt(this.index);
    	}

    	/**
    	 * @returns {number}
    	 */
    	get code() {
    		return this.expr.charCodeAt(this.index);
    	};


    	/**
    	 * @param {string} expr a string with the passed in express
    	 * @returns Jsep
    	 */
    	constructor(expr) {
    		// `index` stores the character number we are currently at
    		// All of the gobbles below will modify `index` as we move along
    		this.expr = expr;
    		this.index = 0;
    	}

    	/**
    	 * static top-level parser
    	 * @returns {jsep.Expression}
    	 */
    	static parse(expr) {
    		return (new Jsep(expr)).parse();
    	}

    	/**
    	 * Get the longest key length of any object
    	 * @param {object} obj
    	 * @returns {number}
    	 */
    	static getMaxKeyLen(obj) {
    		return Math.max(0, ...Object.keys(obj).map(k => k.length));
    	}

    	/**
    	 * `ch` is a character code in the next three functions
    	 * @param {number} ch
    	 * @returns {boolean}
    	 */
    	static isDecimalDigit(ch) {
    		return (ch >= 48 && ch <= 57); // 0...9
    	}

    	/**
    	 * Returns the precedence of a binary operator or `0` if it isn't a binary operator. Can be float.
    	 * @param {string} op_val
    	 * @returns {number}
    	 */
    	static binaryPrecedence(op_val) {
    		return Jsep.binary_ops[op_val] || 0;
    	}

    	/**
    	 * Looks for start of identifier
    	 * @param {number} ch
    	 * @returns {boolean}
    	 */
    	static isIdentifierStart(ch) {
    		return  (ch >= 65 && ch <= 90) || // A...Z
    			(ch >= 97 && ch <= 122) || // a...z
    			(ch >= 128 && !Jsep.binary_ops[String.fromCharCode(ch)]) || // any non-ASCII that is not an operator
    			(Jsep.additional_identifier_chars.has(String.fromCharCode(ch))); // additional characters
    	}

    	/**
    	 * @param {number} ch
    	 * @returns {boolean}
    	 */
    	static isIdentifierPart(ch) {
    		return Jsep.isIdentifierStart(ch) || Jsep.isDecimalDigit(ch);
    	}

    	/**
    	 * throw error at index of the expression
    	 * @param {string} message
    	 * @throws
    	 */
    	throwError(message) {
    		const error = new Error(message + ' at character ' + this.index);
    		error.index = this.index;
    		error.description = message;
    		throw error;
    	}

    	/**
    	 * Run a given hook
    	 * @param {string} name
    	 * @param {jsep.Expression|false} [node]
    	 * @returns {?jsep.Expression}
    	 */
    	runHook(name, node) {
    		if (Jsep.hooks[name]) {
    			const env = { context: this, node };
    			Jsep.hooks.run(name, env);
    			return env.node;
    		}
    		return node;
    	}

    	/**
    	 * Runs a given hook until one returns a node
    	 * @param {string} name
    	 * @returns {?jsep.Expression}
    	 */
    	searchHook(name) {
    		if (Jsep.hooks[name]) {
    			const env = { context: this };
    			Jsep.hooks[name].find(function (callback) {
    				callback.call(env.context, env);
    				return env.node;
    			});
    			return env.node;
    		}
    	}

    	/**
    	 * Push `index` up to the next non-space character
    	 */
    	gobbleSpaces() {
    		let ch = this.code;
    		// Whitespace
    		while (ch === Jsep.SPACE_CODE
    		|| ch === Jsep.TAB_CODE
    		|| ch === Jsep.LF_CODE
    		|| ch === Jsep.CR_CODE) {
    			ch = this.expr.charCodeAt(++this.index);
    		}
    		this.runHook('gobble-spaces');
    	}

    	/**
    	 * Top-level method to parse all expressions and returns compound or single node
    	 * @returns {jsep.Expression}
    	 */
    	parse() {
    		this.runHook('before-all');
    		const nodes = this.gobbleExpressions();

    		// If there's only one expression just try returning the expression
    		const node = nodes.length === 1
    		  ? nodes[0]
    			: {
    				type: Jsep.COMPOUND,
    				body: nodes
    			};
    		return this.runHook('after-all', node);
    	}

    	/**
    	 * top-level parser (but can be reused within as well)
    	 * @param {number} [untilICode]
    	 * @returns {jsep.Expression[]}
    	 */
    	gobbleExpressions(untilICode) {
    		let nodes = [], ch_i, node;

    		while (this.index < this.expr.length) {
    			ch_i = this.code;

    			// Expressions can be separated by semicolons, commas, or just inferred without any
    			// separators
    			if (ch_i === Jsep.SEMCOL_CODE || ch_i === Jsep.COMMA_CODE) {
    				this.index++; // ignore separators
    			}
    			else {
    				// Try to gobble each expression individually
    				if (node = this.gobbleExpression()) {
    					nodes.push(node);
    					// If we weren't able to find a binary expression and are out of room, then
    					// the expression passed in probably has too much
    				}
    				else if (this.index < this.expr.length) {
    					if (ch_i === untilICode) {
    						break;
    					}
    					this.throwError('Unexpected "' + this.char + '"');
    				}
    			}
    		}

    		return nodes;
    	}

    	/**
    	 * The main parsing function.
    	 * @returns {?jsep.Expression}
    	 */
    	gobbleExpression() {
    		const node = this.searchHook('gobble-expression') || this.gobbleBinaryExpression();
    		this.gobbleSpaces();

    		return this.runHook('after-expression', node);
    	}

    	/**
    	 * Search for the operation portion of the string (e.g. `+`, `===`)
    	 * Start by taking the longest possible binary operations (3 characters: `===`, `!==`, `>>>`)
    	 * and move down from 3 to 2 to 1 character until a matching binary operation is found
    	 * then, return that binary operation
    	 * @returns {string|boolean}
    	 */
    	gobbleBinaryOp() {
    		this.gobbleSpaces();
    		let to_check = this.expr.substr(this.index, Jsep.max_binop_len);
    		let tc_len = to_check.length;

    		while (tc_len > 0) {
    			// Don't accept a binary op when it is an identifier.
    			// Binary ops that start with a identifier-valid character must be followed
    			// by a non identifier-part valid character
    			if (Jsep.binary_ops.hasOwnProperty(to_check) && (
    				!Jsep.isIdentifierStart(this.code) ||
    				(this.index + to_check.length < this.expr.length && !Jsep.isIdentifierPart(this.expr.charCodeAt(this.index + to_check.length)))
    			)) {
    				this.index += tc_len;
    				return to_check;
    			}
    			to_check = to_check.substr(0, --tc_len);
    		}
    		return false;
    	}

    	/**
    	 * This function is responsible for gobbling an individual expression,
    	 * e.g. `1`, `1+2`, `a+(b*2)-Math.sqrt(2)`
    	 * @returns {?jsep.BinaryExpression}
    	 */
    	gobbleBinaryExpression() {
    		let node, biop, prec, stack, biop_info, left, right, i, cur_biop;

    		// First, try to get the leftmost thing
    		// Then, check to see if there's a binary operator operating on that leftmost thing
    		// Don't gobbleBinaryOp without a left-hand-side
    		left = this.gobbleToken();
    		if (!left) {
    			return left;
    		}
    		biop = this.gobbleBinaryOp();

    		// If there wasn't a binary operator, just return the leftmost node
    		if (!biop) {
    			return left;
    		}

    		// Otherwise, we need to start a stack to properly place the binary operations in their
    		// precedence structure
    		biop_info = { value: biop, prec: Jsep.binaryPrecedence(biop), right_a: Jsep.right_associative.has(biop) };

    		right = this.gobbleToken();

    		if (!right) {
    			this.throwError("Expected expression after " + biop);
    		}

    		stack = [left, biop_info, right];

    		// Properly deal with precedence using [recursive descent](http://www.engr.mun.ca/~theo/Misc/exp_parsing.htm)
    		while ((biop = this.gobbleBinaryOp())) {
    			prec = Jsep.binaryPrecedence(biop);

    			if (prec === 0) {
    				this.index -= biop.length;
    				break;
    			}

    			biop_info = { value: biop, prec, right_a: Jsep.right_associative.has(biop) };

    			cur_biop = biop;

    			// Reduce: make a binary expression from the three topmost entries.
    			const comparePrev = prev => biop_info.right_a && prev.right_a
    				? prec > prev.prec
    				: prec <= prev.prec;
    			while ((stack.length > 2) && comparePrev(stack[stack.length - 2])) {
    				right = stack.pop();
    				biop = stack.pop().value;
    				left = stack.pop();
    				node = {
    					type: Jsep.BINARY_EXP,
    					operator: biop,
    					left,
    					right
    				};
    				stack.push(node);
    			}

    			node = this.gobbleToken();

    			if (!node) {
    				this.throwError("Expected expression after " + cur_biop);
    			}

    			stack.push(biop_info, node);
    		}

    		i = stack.length - 1;
    		node = stack[i];

    		while (i > 1) {
    			node = {
    				type: Jsep.BINARY_EXP,
    				operator: stack[i - 1].value,
    				left: stack[i - 2],
    				right: node
    			};
    			i -= 2;
    		}

    		return node;
    	}

    	/**
    	 * An individual part of a binary expression:
    	 * e.g. `foo.bar(baz)`, `1`, `"abc"`, `(a % 2)` (because it's in parenthesis)
    	 * @returns {boolean|jsep.Expression}
    	 */
    	gobbleToken() {
    		let ch, to_check, tc_len, node;

    		this.gobbleSpaces();
    		node = this.searchHook('gobble-token');
    		if (node) {
    			return this.runHook('after-token', node);
    		}

    		ch = this.code;

    		if (Jsep.isDecimalDigit(ch) || ch === Jsep.PERIOD_CODE) {
    			// Char code 46 is a dot `.` which can start off a numeric literal
    			return this.gobbleNumericLiteral();
    		}

    		if (ch === Jsep.SQUOTE_CODE || ch === Jsep.DQUOTE_CODE) {
    			// Single or double quotes
    			node = this.gobbleStringLiteral();
    		}
    		else if (ch === Jsep.OBRACK_CODE) {
    			node = this.gobbleArray();
    		}
    		else {
    			to_check = this.expr.substr(this.index, Jsep.max_unop_len);
    			tc_len = to_check.length;

    			while (tc_len > 0) {
    				// Don't accept an unary op when it is an identifier.
    				// Unary ops that start with a identifier-valid character must be followed
    				// by a non identifier-part valid character
    				if (Jsep.unary_ops.hasOwnProperty(to_check) && (
    					!Jsep.isIdentifierStart(this.code) ||
    					(this.index + to_check.length < this.expr.length && !Jsep.isIdentifierPart(this.expr.charCodeAt(this.index + to_check.length)))
    				)) {
    					this.index += tc_len;
    					const argument = this.gobbleToken();
    					if (!argument) {
    						this.throwError('missing unaryOp argument');
    					}
    					return this.runHook('after-token', {
    						type: Jsep.UNARY_EXP,
    						operator: to_check,
    						argument,
    						prefix: true
    					});
    				}

    				to_check = to_check.substr(0, --tc_len);
    			}

    			if (Jsep.isIdentifierStart(ch)) {
    				node = this.gobbleIdentifier();
    				if (Jsep.literals.hasOwnProperty(node.name)) {
    					node = {
    						type: Jsep.LITERAL,
    						value: Jsep.literals[node.name],
    						raw: node.name,
    					};
    				}
    				else if (node.name === Jsep.this_str) {
    					node = { type: Jsep.THIS_EXP };
    				}
    			}
    			else if (ch === Jsep.OPAREN_CODE) { // open parenthesis
    				node = this.gobbleGroup();
    			}
    		}

    		if (!node) {
    			return this.runHook('after-token', false);
    		}

    		node = this.gobbleTokenProperty(node);
    		return this.runHook('after-token', node);
    	}

    	/**
    	 * Gobble properties of of identifiers/strings/arrays/groups.
    	 * e.g. `foo`, `bar.baz`, `foo['bar'].baz`
    	 * It also gobbles function calls:
    	 * e.g. `Math.acos(obj.angle)`
    	 * @param {jsep.Expression} node
    	 * @returns {jsep.Expression}
    	 */
    	gobbleTokenProperty(node) {
    		this.gobbleSpaces();

    		let ch = this.code;
    		while (ch === Jsep.PERIOD_CODE || ch === Jsep.OBRACK_CODE || ch === Jsep.OPAREN_CODE || ch === Jsep.QUMARK_CODE) {
    			let optional;
    			if (ch === Jsep.QUMARK_CODE) {
    				if (this.expr.charCodeAt(this.index + 1) !== Jsep.PERIOD_CODE) {
    					break;
    				}
    				optional = true;
    				this.index += 2;
    				this.gobbleSpaces();
    				ch = this.code;
    			}
    			this.index++;

    			if (ch === Jsep.OBRACK_CODE) {
    				node = {
    					type: Jsep.MEMBER_EXP,
    					computed: true,
    					object: node,
    					property: this.gobbleExpression()
    				};
    				this.gobbleSpaces();
    				ch = this.code;
    				if (ch !== Jsep.CBRACK_CODE) {
    					this.throwError('Unclosed [');
    				}
    				this.index++;
    			}
    			else if (ch === Jsep.OPAREN_CODE) {
    				// A function call is being made; gobble all the arguments
    				node = {
    					type: Jsep.CALL_EXP,
    					'arguments': this.gobbleArguments(Jsep.CPAREN_CODE),
    					callee: node
    				};
    			}
    			else if (ch === Jsep.PERIOD_CODE || optional) {
    				if (optional) {
    					this.index--;
    				}
    				this.gobbleSpaces();
    				node = {
    					type: Jsep.MEMBER_EXP,
    					computed: false,
    					object: node,
    					property: this.gobbleIdentifier(),
    				};
    			}

    			if (optional) {
    				node.optional = true;
    			} // else leave undefined for compatibility with esprima

    			this.gobbleSpaces();
    			ch = this.code;
    		}

    		return node;
    	}

    	/**
    	 * Parse simple numeric literals: `12`, `3.4`, `.5`. Do this by using a string to
    	 * keep track of everything in the numeric literal and then calling `parseFloat` on that string
    	 * @returns {jsep.Literal}
    	 */
    	gobbleNumericLiteral() {
    		let number = '', ch, chCode;

    		while (Jsep.isDecimalDigit(this.code)) {
    			number += this.expr.charAt(this.index++);
    		}

    		if (this.code === Jsep.PERIOD_CODE) { // can start with a decimal marker
    			number += this.expr.charAt(this.index++);

    			while (Jsep.isDecimalDigit(this.code)) {
    				number += this.expr.charAt(this.index++);
    			}
    		}

    		ch = this.char;

    		if (ch === 'e' || ch === 'E') { // exponent marker
    			number += this.expr.charAt(this.index++);
    			ch = this.char;

    			if (ch === '+' || ch === '-') { // exponent sign
    				number += this.expr.charAt(this.index++);
    			}

    			while (Jsep.isDecimalDigit(this.code)) { // exponent itself
    				number += this.expr.charAt(this.index++);
    			}

    			if (!Jsep.isDecimalDigit(this.expr.charCodeAt(this.index - 1)) ) {
    				this.throwError('Expected exponent (' + number + this.char + ')');
    			}
    		}

    		chCode = this.code;

    		// Check to make sure this isn't a variable name that start with a number (123abc)
    		if (Jsep.isIdentifierStart(chCode)) {
    			this.throwError('Variable names cannot start with a number (' +
    				number + this.char + ')');
    		}
    		else if (chCode === Jsep.PERIOD_CODE || (number.length === 1 && number.charCodeAt(0) === Jsep.PERIOD_CODE)) {
    			this.throwError('Unexpected period');
    		}

    		return {
    			type: Jsep.LITERAL,
    			value: parseFloat(number),
    			raw: number
    		};
    	}

    	/**
    	 * Parses a string literal, staring with single or double quotes with basic support for escape codes
    	 * e.g. `"hello world"`, `'this is\nJSEP'`
    	 * @returns {jsep.Literal}
    	 */
    	gobbleStringLiteral() {
    		let str = '';
    		const startIndex = this.index;
    		const quote = this.expr.charAt(this.index++);
    		let closed = false;

    		while (this.index < this.expr.length) {
    			let ch = this.expr.charAt(this.index++);

    			if (ch === quote) {
    				closed = true;
    				break;
    			}
    			else if (ch === '\\') {
    				// Check for all of the common escape codes
    				ch = this.expr.charAt(this.index++);

    				switch (ch) {
    					case 'n': str += '\n'; break;
    					case 'r': str += '\r'; break;
    					case 't': str += '\t'; break;
    					case 'b': str += '\b'; break;
    					case 'f': str += '\f'; break;
    					case 'v': str += '\x0B'; break;
    					default : str += ch;
    				}
    			}
    			else {
    				str += ch;
    			}
    		}

    		if (!closed) {
    			this.throwError('Unclosed quote after "' + str + '"');
    		}

    		return {
    			type: Jsep.LITERAL,
    			value: str,
    			raw: this.expr.substring(startIndex, this.index),
    		};
    	}

    	/**
    	 * Gobbles only identifiers
    	 * e.g.: `foo`, `_value`, `$x1`
    	 * Also, this function checks if that identifier is a literal:
    	 * (e.g. `true`, `false`, `null`) or `this`
    	 * @returns {jsep.Identifier}
    	 */
    	gobbleIdentifier() {
    		let ch = this.code, start = this.index;

    		if (Jsep.isIdentifierStart(ch)) {
    			this.index++;
    		}
    		else {
    			this.throwError('Unexpected ' + this.char);
    		}

    		while (this.index < this.expr.length) {
    			ch = this.code;

    			if (Jsep.isIdentifierPart(ch)) {
    				this.index++;
    			}
    			else {
    				break;
    			}
    		}
    		return {
    			type: Jsep.IDENTIFIER,
    			name: this.expr.slice(start, this.index),
    		};
    	}

    	/**
    	 * Gobbles a list of arguments within the context of a function call
    	 * or array literal. This function also assumes that the opening character
    	 * `(` or `[` has already been gobbled, and gobbles expressions and commas
    	 * until the terminator character `)` or `]` is encountered.
    	 * e.g. `foo(bar, baz)`, `my_func()`, or `[bar, baz]`
    	 * @param {number} termination
    	 * @returns {jsep.Expression[]}
    	 */
    	gobbleArguments(termination) {
    		const args = [];
    		let closed = false;
    		let separator_count = 0;

    		while (this.index < this.expr.length) {
    			this.gobbleSpaces();
    			let ch_i = this.code;

    			if (ch_i === termination) { // done parsing
    				closed = true;
    				this.index++;

    				if (termination === Jsep.CPAREN_CODE && separator_count && separator_count >= args.length){
    					this.throwError('Unexpected token ' + String.fromCharCode(termination));
    				}

    				break;
    			}
    			else if (ch_i === Jsep.COMMA_CODE) { // between expressions
    				this.index++;
    				separator_count++;

    				if (separator_count !== args.length) { // missing argument
    					if (termination === Jsep.CPAREN_CODE) {
    						this.throwError('Unexpected token ,');
    					}
    					else if (termination === Jsep.CBRACK_CODE) {
    						for (let arg = args.length; arg < separator_count; arg++) {
    							args.push(null);
    						}
    					}
    				}
    			}
    			else if (args.length !== separator_count && separator_count !== 0) {
    				// NOTE: `&& separator_count !== 0` allows for either all commas, or all spaces as arguments
    				this.throwError('Expected comma');
    			}
    			else {
    				const node = this.gobbleExpression();

    				if (!node || node.type === Jsep.COMPOUND) {
    					this.throwError('Expected comma');
    				}

    				args.push(node);
    			}
    		}

    		if (!closed) {
    			this.throwError('Expected ' + String.fromCharCode(termination));
    		}

    		return args;
    	}

    	/**
    	 * Responsible for parsing a group of things within parentheses `()`
    	 * that have no identifier in front (so not a function call)
    	 * This function assumes that it needs to gobble the opening parenthesis
    	 * and then tries to gobble everything within that parenthesis, assuming
    	 * that the next thing it should see is the close parenthesis. If not,
    	 * then the expression probably doesn't have a `)`
    	 * @returns {boolean|jsep.Expression}
    	 */
    	gobbleGroup() {
    		this.index++;
    		let nodes = this.gobbleExpressions(Jsep.CPAREN_CODE);
    		if (this.code === Jsep.CPAREN_CODE) {
    			this.index++;
    			if (nodes.length === 1) {
    				return nodes[0];
    			}
    			else if (!nodes.length) {
    				return false;
    			}
    			else {
    				return {
    					type: Jsep.SEQUENCE_EXP,
    					expressions: nodes,
    				};
    			}
    		}
    		else {
    			this.throwError('Unclosed (');
    		}
    	}

    	/**
    	 * Responsible for parsing Array literals `[1, 2, 3]`
    	 * This function assumes that it needs to gobble the opening bracket
    	 * and then tries to gobble the expressions as arguments.
    	 * @returns {jsep.ArrayExpression}
    	 */
    	gobbleArray() {
    		this.index++;

    		return {
    			type: Jsep.ARRAY_EXP,
    			elements: this.gobbleArguments(Jsep.CBRACK_CODE)
    		};
    	}
    }

    // Static fields:
    const hooks = new Hooks();
    Object.assign(Jsep, {
    	hooks,
    	plugins: new Plugins(Jsep),

    	// Node Types
    	// ----------
    	// This is the full set of types that any JSEP node can be.
    	// Store them here to save space when minified
    	COMPOUND:        'Compound',
    	SEQUENCE_EXP:    'SequenceExpression',
    	IDENTIFIER:      'Identifier',
    	MEMBER_EXP:      'MemberExpression',
    	LITERAL:         'Literal',
    	THIS_EXP:        'ThisExpression',
    	CALL_EXP:        'CallExpression',
    	UNARY_EXP:       'UnaryExpression',
    	BINARY_EXP:      'BinaryExpression',
    	ARRAY_EXP:       'ArrayExpression',

    	TAB_CODE:    9,
    	LF_CODE:     10,
    	CR_CODE:     13,
    	SPACE_CODE:  32,
    	PERIOD_CODE: 46, // '.'
    	COMMA_CODE:  44, // ','
    	SQUOTE_CODE: 39, // single quote
    	DQUOTE_CODE: 34, // double quotes
    	OPAREN_CODE: 40, // (
    	CPAREN_CODE: 41, // )
    	OBRACK_CODE: 91, // [
    	CBRACK_CODE: 93, // ]
    	QUMARK_CODE: 63, // ?
    	SEMCOL_CODE: 59, // ;
    	COLON_CODE:  58, // :


    	// Operations
    	// ----------
    	// Use a quickly-accessible map to store all of the unary operators
    	// Values are set to `1` (it really doesn't matter)
    	unary_ops: {
    		'-': 1,
    		'!': 1,
    		'~': 1,
    		'+': 1
    	},

    	// Also use a map for the binary operations but set their values to their
    	// binary precedence for quick reference (higher number = higher precedence)
    	// see [Order of operations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence)
    	binary_ops: {
    		'||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
    		'==': 6, '!=': 6, '===': 6, '!==': 6,
    		'<': 7, '>': 7, '<=': 7, '>=': 7,
    		'<<': 8, '>>': 8, '>>>': 8,
    		'+': 9, '-': 9,
    		'*': 10, '/': 10, '%': 10
    	},

    	// sets specific binary_ops as right-associative
    	right_associative: new Set(),

    	// Additional valid identifier chars, apart from a-z, A-Z and 0-9 (except on the starting char)
    	additional_identifier_chars: new Set(['$', '_']),

    	// Literals
    	// ----------
    	// Store the values to return for the various literals we may encounter
    	literals: {
    		'true': true,
    		'false': false,
    		'null': null
    	},

    	// Except for `this`, which is special. This could be changed to something like `'self'` as well
    	this_str: 'this',
    });
    Jsep.max_unop_len = Jsep.getMaxKeyLen(Jsep.unary_ops);
    Jsep.max_binop_len = Jsep.getMaxKeyLen(Jsep.binary_ops);

    // Backward Compatibility:
    const jsep = expr => (new Jsep(expr)).parse();
    const staticMethods = Object.getOwnPropertyNames(Jsep);
    staticMethods
    	.forEach((m) => {
    		if (jsep[m] === undefined && m !== 'prototype') {
    			jsep[m] = Jsep[m];
    		}
    	});
    jsep.Jsep = Jsep; // allows for const { Jsep } = require('jsep');

    const CONDITIONAL_EXP = 'ConditionalExpression';

    var ternary = {
    	name: 'ternary',

    	init(jsep) {
    		// Ternary expression: test ? consequent : alternate
    		jsep.hooks.add('after-expression', function gobbleTernary(env) {
    			if (env.node && this.code === jsep.QUMARK_CODE) {
    				this.index++;
    				const test = env.node;
    				const consequent = this.gobbleExpression();

    				if (!consequent) {
    					this.throwError('Expected expression');
    				}

    				this.gobbleSpaces();

    				if (this.code === jsep.COLON_CODE) {
    					this.index++;
    					const alternate = this.gobbleExpression();

    					if (!alternate) {
    						this.throwError('Expected expression');
    					}
    					env.node = {
    						type: CONDITIONAL_EXP,
    						test,
    						consequent,
    						alternate,
    					};

    					// check for operators of higher priority than ternary (i.e. assignment)
    					// jsep sets || at 1, and assignment at 0.9, and conditional should be between them
    					if (test.operator && jsep.binary_ops[test.operator] <= 0.9) {
    						let newTest = test;
    						while (newTest.right.operator && jsep.binary_ops[newTest.right.operator] <= 0.9) {
    							newTest = newTest.right;
    						}
    						env.node.test = newTest.right;
    						newTest.right = env.node;
    						env.node = test;
    					}
    				}
    				else {
    					this.throwError('Expected :');
    				}
    			}
    		});
    	},
    };

    // Add default plugins:

    jsep.plugins.register(ternary);

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
    var operators = {
        binary: {
            '===': function (a, b) { return (a === b); },
            '!==': function (a, b) { return (a !== b); },
            '==': function (a, b) { return (a == b); },
            '!=': function (a, b) { return (a != b); },
            '>': function (a, b) { return (a > b); },
            '<': function (a, b) { return (a < b); },
            '>=': function (a, b) { return (a >= b); },
            '<=': function (a, b) { return (a <= b); },
            '+': function (a, b) { return (a + b); },
            '-': function (a, b) { return (a - b); },
            '*': function (a, b) { return (a * b); },
            '/': function (a, b) { return (a / b); },
            '%': function (a, b) { return (a % b); },
            '**': function (a, b) { return (Math.pow(a, b)); },
            '&': function (a, b) { return (a & b); },
            '|': function (a, b) { return (a | b); },
            '^': function (a, b) { return (a ^ b); },
            '<<': function (a, b) { return (a << b); },
            '>>': function (a, b) { return (a >> b); },
            '>>>': function (a, b) { return (a >>> b); },
            // Let's make a home for the logical operators here as well
            '||': function (a, b) { return (a || b); },
            '&&': function (a, b) { return (a && b); }
        },
        unary: {
            '!': function (a) { return !a; },
            '~': function (a) { return ~a; },
            '+': function (a) { return +a; },
            '-': function (a) { return -a; },
            '++': function (a) { return ++a; },
            '--': function (a) { return --a; }
        }
    };
    var types = {
        // supported
        LITERAL: 'Literal',
        UNARY: 'UnaryExpression',
        BINARY: 'BinaryExpression',
        LOGICAL: 'LogicalExpression',
        CONDITIONAL: 'ConditionalExpression',
        MEMBER: 'MemberExpression',
        IDENTIFIER: 'Identifier',
        THIS: 'ThisExpression',
        CALL: 'CallExpression',
        ARRAY: 'ArrayExpression',
        COMPOUND: 'Compound' // 'a===2, b===3' <-- multiple comma separated expressions.. returns last
    };
    var undefOperator = function () { return undefined; };
    var getParameterPath = function (node, context) {
        assert(node, 'Node missing');
        var type = node.type;
        assert(Object.values(types).includes(type), 'invalid type ' + type);
        assert([types.MEMBER, types.IDENTIFIER].includes(type), 'Invalid parameter path node type: ' + type);
        // the easy case: 'IDENTIFIER's
        if (type === types.IDENTIFIER) {
            return node.name;
        }
        // Otherwise it's a MEMBER expression
        // EXAMPLES:  a[b] (computed)
        //            a.b (not computed)
        var computed = node.computed;
        var object = node.object;
        var property = node.property;
        // object is either 'IDENTIFIER', 'MEMBER', or 'THIS'
        assert([types.MEMBER, types.IDENTIFIER, types.THIS].includes(object.type), 'Invalid object type');
        assert(property, 'Member expression property is missing');
        var objectPath = '';
        if (object.type === types.THIS) {
            objectPath = '';
        }
        else {
            objectPath = node.name || getParameterPath(object, context);
        }
        if (computed) {
            // if computed -> evaluate anew
            var propertyPath = evaluateExpressionNode(property, context);
            return objectPath + '[' + propertyPath + ']';
        }
        else {
            assert([types.MEMBER, types.IDENTIFIER].includes(property.type), 'Invalid object type');
            var propertyPath = property.name || getParameterPath(property, context);
            return (objectPath ? objectPath + '.' : '') + propertyPath;
        }
    };
    var evaluateExpressionNode = function (node, context) {
        assert(node, 'Node missing');
        assert(Object.values(types).includes(node.type), "invalid node type", node);
        switch (node.type) {
            case types.LITERAL: {
                return node.value;
            }
            case types.THIS: {
                return context;
            }
            case types.COMPOUND: {
                var expressions = node.body.map(function (el) { return evaluateExpressionNode(el, context); });
                return expressions.pop();
            }
            case types.ARRAY: {
                return node.elements.map(function (el) { return evaluateExpressionNode(el, context); });
            }
            case types.UNARY: {
                var operator = operators.unary[node.operator] || undefOperator;
                assert(operators.unary[operator], 'Invalid unary operator');
                var argument = evaluateExpressionNode(node.argument, context);
                return operator(argument);
            }
            case types.LOGICAL: // !!! fall-through to BINARY !!! //
            case types.BINARY: {
                var operator = operators.binary[node.operator] || undefOperator;
                assert(operators.binary[operator], 'Invalid binary operator');
                var left = evaluateExpressionNode(node.left, context);
                var right = evaluateExpressionNode(node.right, context);
                return operator(left, right);
            }
            case types.CONDITIONAL: {
                var test = evaluateExpressionNode(node.test, context);
                var consequent = evaluateExpressionNode(node.consequent, context);
                var alternate = evaluateExpressionNode(node.alternate, context);
                return test ? consequent : alternate;
            }
            case types.CALL: {
                assert([types.MEMBER, types.IDENTIFIER, types.THIS].includes(node.callee.type), 'Invalid function callee type');
                var callee = evaluateExpressionNode(node.callee, context);
                var args = node.arguments.map(function (arg) { return evaluateExpressionNode(arg, context); });
                return callee.apply(null, args);
            }
            case types.IDENTIFIER: // !!! fall-through to MEMBER !!! //
            case types.MEMBER: {
                var path = getParameterPath(node, context);
                return _get(context, path);
            }
            default:
                return undefined;
        }
    };
    var evaluate = function (expression, context) {
        var tree = jsep(expression);
        return evaluateExpressionNode(tree, context);
    };
    function assert(value, errorMsg, errorArgs) {
        if (value === undefined)
            return;
        if (!!value)
            return;
        if (!value) {
            console.error(errorMsg, errorArgs);
            throw Error(errorMsg);
        }
    }
    function _get(object, keys, defaultVal) {
        keys = Array.isArray(keys) ? keys : keys.split('.');
        object = object[keys[0]];
        if (object && keys.length > 1) {
            return _get(object, keys.slice(1));
        }
        return object === undefined ? defaultVal : object;
    }

    exports.EVENT = void 0;
    (function (EVENT) {
        EVENT[EVENT["EVENT_VARIABLE_CHANGE"] = 0] = "EVENT_VARIABLE_CHANGE";
    })(exports.EVENT || (exports.EVENT = {}));
    var createExpressionManager = function (initialState, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.initialAssignments, initialAssignments = _c === void 0 ? null : _c, context = _b.context;
        var defaultContext = __assign({}, context);
        var store = createState(initialState);
        var callbacks = {
            onEvent: []
        };
        var variableControlReadLinksMap = {};
        var assignmentDependencies = {};
        var DEFAULT_ACC_EVENT = function () { return ({
            targetControlIds: [],
            newValues: {},
            oldValues: {}
        }); };
        var state = {
            accEvent: DEFAULT_ACC_EVENT()
        };
        store.onChange(function (_a) {
            var newValue = _a.newValue, oldValue = _a.oldValue, prop = _a.prop;
            var delayedAssignments = [];
            applyVariableAssignmentFromVariableName(prop);
            var targetControlIds = Array.from(new Set(__spreadArray(__spreadArray([], (variableControlReadLinksMap[prop] || []).map(function (c) { return c.id; }), true), getControlsAffectedByAssignmentTo(prop).map(function (c) { return c.id; }), true)));
            state.accEvent.targetControlIds = Array.from(new Set(__spreadArray(__spreadArray([], state.accEvent.targetControlIds, true), targetControlIds, true))); //TODO can be optimized if necessary
            state.accEvent.newValues[prop] = newValue;
            state.accEvent.oldValues[prop] = oldValue;
            if (delayedAssignments) {
                delayedAssignments.forEach(function (delayedAssignment) {
                    var fn = delayedAssignment[0], assignment = delayedAssignment[1];
                    var timeout = assignment.timeout, condition = assignment.condition;
                    //TODO review if it would be better to define a setState wrapper function that does the joinEvent inside
                    setTimeout(function () {
                        if (condition && evaluateExpression(condition)) {
                            joinEvent(fn, true);
                        }
                        else if (!condition) {
                            joinEvent(fn, true);
                        }
                    }, timeout);
                    removeValueFromArray(delayedAssignments, delayedAssignment);
                });
            }
            function applyVariableAssignmentFromVariableName(listenVariable) {
                var assignmentsMap = assignmentDependencies[listenVariable] || {};
                Object.keys(assignmentsMap).forEach(function (assignmentStorageName) {
                    var assignment = assignmentsMap[assignmentStorageName];
                    if (assignment.timeout) {
                        delayedAssignments.push([applyEvaluation, assignment]);
                    }
                    else {
                        applyEvaluation();
                    }
                    function applyEvaluation() {
                        var _a, _b;
                        if (assignment.condition) {
                            var conditionResult = evaluateExpression(assignment.condition);
                            if (conditionResult) {
                                store.setState((_a = {}, _a[assignmentStorageName] = evaluateExpression(assignment.expression), _a));
                            }
                        }
                        else {
                            store.setState((_b = {}, _b[assignmentStorageName] = evaluateExpression(assignment.expression), _b));
                        }
                    }
                });
            }
        });
        if (initialAssignments) {
            var initializationState = Object.keys(initialAssignments).reduce(function (acc, variableName) {
                var evaluation = evaluateExpression(initialAssignments[variableName]);
                acc[variableName] = evaluation;
                return acc;
            }, {});
            store.setState(initializationState);
        }
        function getControlsAffectedByAssignmentTo(changedVariableName) {
            var changedStorages = Object.keys(assignmentDependencies[changedVariableName] || {});
            return changedStorages.flat().map(function (storage) { return variableControlReadLinksMap[storage]; }).flat().filter(function (i) { return i; });
        }
        function joinEvent(fn, isDelayed) {
            state.accEvent = DEFAULT_ACC_EVENT();
            fn();
            callbacks.onEvent.forEach(function (fn) {
                fn({
                    type: exports.EVENT.EVENT_VARIABLE_CHANGE,
                    data: __assign(__assign({}, state.accEvent), { isDelayed: !!isDelayed })
                });
            });
        }
        return {
            addControl: (function (_a) {
                var id = _a.id, runtime = _a.runtime; _a.defaultValue;
                var storage = runtime.storage;
                var expressionsToListen = Object.values(runtime).filter(function (i) { return i; });
                var variableNames = expressionsToListen.map(function (e) { return getVariablesFromNode([], jsep(e)); }).flat();
                var control = {
                    id: id,
                    runtime: runtime,
                    setValue: storage && (function (value) {
                        joinEvent(function () {
                            var _a;
                            return store.setState((_a = {}, _a[storage] = value, _a));
                        });
                    }),
                    evaluate: function (prop) {
                        if (!prop) {
                            return storage && store.getState()[storage]; //:evaluateExpression(read)
                        }
                        else {
                            return evaluateExpression(runtime[prop], store.getState());
                        }
                    }
                };
                variableNames.forEach(function (variableName) {
                    variableControlReadLinksMap[variableName] = variableControlReadLinksMap[variableName] || [];
                    if (variableControlReadLinksMap[variableName].indexOf(control) === -1) {
                        variableControlReadLinksMap[variableName].push(control);
                    }
                });
                return control;
            }),
            addRuntimeAssignment: function (_a) {
                var storage = _a.storage, expression = _a.expression, listen = _a.listen, timeout = _a.timeout, condition = _a.condition;
                var variableNamesToListen = listen ? __spreadArray([], listen.split(",").map(function (l) { return l.trim(); }), true) : (getVariablesFromNode([], jsep(expression)) || []);
                variableNamesToListen.forEach(function (listenVariable) {
                    assignmentDependencies[listenVariable] = assignmentDependencies[listenVariable] || {};
                    assignmentDependencies[listenVariable][storage] = { storage: storage, expression: expression, listen: listen, timeout: timeout, condition: condition };
                });
            },
            setState: function (value) { return joinEvent(function () { return store.setState(value); }); },
            getState: function () { return store.getState(); },
            onEvent: function (fn) {
                callbacks.onEvent.push(fn);
                return function () { return callbacks.onEvent.splice(callbacks.onEvent.indexOf(fn), 1); };
            },
            dispose: function () {
                //TODO
            }
        };
        function evaluateExpression(expression, context) {
            if (context === void 0) { context = store.getState(); }
            var result = evaluate(expression, __assign(__assign({}, defaultContext), context));
            return result;
        }
    };
    function getVariablesFromNode(acc, node) {
        if (node.type === "Identifier") {
            return __spreadArray(__spreadArray([], acc, true), [node.name], false);
        }
        else if (node.argument) {
            return __spreadArray(__spreadArray([], acc, true), node.argument.type === "Identifier" && getVariablesFromNode(acc, node.argument) || [], true);
        }
        else if (node.operator) {
            return __spreadArray(__spreadArray([], node.left.type !== "Literal" && getVariablesFromNode(acc, node.left) || [], true), node.right.type !== "Literal" && getVariablesFromNode(acc, node.right) || [], true);
        }
        else if (node.CallExpression) {
            return __spreadArray([], (node.arguments.map(function (a) { return getVariablesFromNode(acc, a); }).flatMap()), true);
        }
    }
    function removeValueFromArray(array, value) {
        var index = array.indexOf(value);
        array.splice(index, 1);
        return ~index;
    }

    exports.createExpressionManager = createExpressionManager;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9zdGF0ZS50cyIsIi4uL25vZGVfbW9kdWxlcy9qc2VwL2Rpc3QvanNlcC5qcyIsIi4uL3NyYy9qc2VwLWV2YWwudHMiLCIuLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGludGVyZmFjZSBTdGF0ZTxUPiB7XG4gICAgZ2V0U3RhdGU6KCk9PlQsXG4gICAgc2V0U3RhdGU6RnVuY3Rpb24sXG4gICAgb25DaGFuZ2U6RnVuY3Rpb24sXG4gICAgZGlzcG9zZTpGdW5jdGlvblxufTtcblxuLyoqXG4gKiBOYWl2ZSBzdGF0ZSBtYW5hZ2VyIGFwcHJvYWNoIHdpdGggc3Vic2NyaXB0aW9uLCAxIGxldmVsIHN0YXRlIGtleS92YWx1ZVxuICovXG4gY29uc3QgY3JlYXRlU3RhdGUgPSAoaW5pdGlhbFN0YXRlKSA9PiB7XG4gICAgY29uc3Qgc3RhdGUgPSB7Li4uaW5pdGlhbFN0YXRlfTtcbiAgICBjb25zdCBzdWJzOntvbkNoYW5nZTpNYXA8c3RyaW5nfHVuZGVmaW5lZCwgU2V0PEZ1bmN0aW9uPj59ID0ge1xuICAgICAgICBvbkNoYW5nZTpuZXcgTWFwKClcbiAgICB9O1xuICAgIGNvbnN0IHN0YXRlUCA9IG5ldyBQcm94eShzdGF0ZSwge1xuICAgICAgICBzZXQ6KG9iaiwgcHJvcCwgdmFsdWUpID0+IHtcbiAgICAgICAgICAgIGxldCBvbGRWYWx1ZSA9IG9ialtwcm9wXTtcbiAgICAgICAgICAgIGlmKG9sZFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBjb25zdCB0cmlnZ2VyQ2FsbGJhY2sgPSAoY2FsbGJhY2spPT57XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soe1xuICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZTp2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHByb3BcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBvYmpbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHN1YnMub25DaGFuZ2UuZ2V0KHByb3AgYXMgc3RyaW5nKT8uZm9yRWFjaCh0cmlnZ2VyQ2FsbGJhY2spO1xuICAgICAgICAgICAgc3Vicy5vbkNoYW5nZS5nZXQodW5kZWZpbmVkKT8uZm9yRWFjaCh0cmlnZ2VyQ2FsbGJhY2spO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3Qgb25DaGFuZ2UgPSAoY2FsbGJhY2s6RnVuY3Rpb24sIGtleVByb3A/OnN0cmluZykgPT4ge1xuICAgICAgICBpZighc3Vicy5vbkNoYW5nZS5oYXMoa2V5UHJvcCkpIHN1YnMub25DaGFuZ2Uuc2V0KGtleVByb3AsIG5ldyBTZXQoKSk7XG4gICAgICAgIHN1YnMub25DaGFuZ2UuZ2V0KGtleVByb3ApPy5hZGQoY2FsbGJhY2spO1xuXG4gICAgICAgIHJldHVybiAoKSA9PiB7ICAgICAgICAgICAgXG4gICAgICAgICAgICBzdWJzLm9uQ2hhbmdlLmdldChrZXlQcm9wKT8uZGVsZXRlKGNhbGxiYWNrKTsgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzZXRTdGF0ZToodmFsdWUpPT57XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKHN0YXRlUCwgdmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgICBnZXRTdGF0ZTooKT0+c3RhdGVQLFxuICAgICAgICBvbkNoYW5nZSxcbiAgICAgICAgZGlzcG9zZTooKT0+e1xuICAgICAgICAgICAgc3Vicy5vbkNoYW5nZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZXhwb3J0IHtcbiAgICBjcmVhdGVTdGF0ZVxufTsiLCIvKipcbiAqIEBpbXBsZW1lbnRzIHtJSG9va3N9XG4gKi9cbmNsYXNzIEhvb2tzIHtcblx0LyoqXG5cdCAqIEBjYWxsYmFjayBIb29rQ2FsbGJhY2tcblx0ICogQHRoaXMgeyp8SnNlcH0gdGhpc1xuXHQgKiBAcGFyYW0ge0pzZXB9IGVudlxuXHQgKiBAcmV0dXJuczogdm9pZFxuXHQgKi9cblx0LyoqXG5cdCAqIEFkZHMgdGhlIGdpdmVuIGNhbGxiYWNrIHRvIHRoZSBsaXN0IG9mIGNhbGxiYWNrcyBmb3IgdGhlIGdpdmVuIGhvb2suXG5cdCAqXG5cdCAqIFRoZSBjYWxsYmFjayB3aWxsIGJlIGludm9rZWQgd2hlbiB0aGUgaG9vayBpdCBpcyByZWdpc3RlcmVkIGZvciBpcyBydW4uXG5cdCAqXG5cdCAqIE9uZSBjYWxsYmFjayBmdW5jdGlvbiBjYW4gYmUgcmVnaXN0ZXJlZCB0byBtdWx0aXBsZSBob29rcyBhbmQgdGhlIHNhbWUgaG9vayBtdWx0aXBsZSB0aW1lcy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBob29rLCBvciBhbiBvYmplY3Qgb2YgY2FsbGJhY2tzIGtleWVkIGJ5IG5hbWVcblx0ICogQHBhcmFtIHtIb29rQ2FsbGJhY2t8Ym9vbGVhbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHdoaWNoIGlzIGdpdmVuIGVudmlyb25tZW50IHZhcmlhYmxlcy5cblx0ICogQHBhcmFtIHs/Ym9vbGVhbn0gW2ZpcnN0PWZhbHNlXSBXaWxsIGFkZCB0aGUgaG9vayB0byB0aGUgdG9wIG9mIHRoZSBsaXN0IChkZWZhdWx0cyB0byB0aGUgYm90dG9tKVxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRhZGQobmFtZSwgY2FsbGJhY2ssIGZpcnN0KSB7XG5cdFx0aWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gIT0gJ3N0cmluZycpIHtcblx0XHRcdC8vIE11bHRpcGxlIGhvb2sgY2FsbGJhY2tzLCBrZXllZCBieSBuYW1lXG5cdFx0XHRmb3IgKGxldCBuYW1lIGluIGFyZ3VtZW50c1swXSkge1xuXHRcdFx0XHR0aGlzLmFkZChuYW1lLCBhcmd1bWVudHNbMF1bbmFtZV0sIGFyZ3VtZW50c1sxXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0KEFycmF5LmlzQXJyYXkobmFtZSkgPyBuYW1lIDogW25hbWVdKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG5cdFx0XHRcdHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdIHx8IFtdO1xuXG5cdFx0XHRcdGlmIChjYWxsYmFjaykge1xuXHRcdFx0XHRcdHRoaXNbbmFtZV1bZmlyc3QgPyAndW5zaGlmdCcgOiAncHVzaCddKGNhbGxiYWNrKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJ1bnMgYSBob29rIGludm9raW5nIGFsbCByZWdpc3RlcmVkIGNhbGxiYWNrcyB3aXRoIHRoZSBnaXZlbiBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG5cdCAqXG5cdCAqIENhbGxiYWNrcyB3aWxsIGJlIGludm9rZWQgc3luY2hyb25vdXNseSBhbmQgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZXkgd2VyZSByZWdpc3RlcmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgaG9vay5cblx0ICogQHBhcmFtIHtPYmplY3Q8c3RyaW5nLCBhbnk+fSBlbnYgVGhlIGVudmlyb25tZW50IHZhcmlhYmxlcyBvZiB0aGUgaG9vayBwYXNzZWQgdG8gYWxsIGNhbGxiYWNrcyByZWdpc3RlcmVkLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRydW4obmFtZSwgZW52KSB7XG5cdFx0dGhpc1tuYW1lXSA9IHRoaXNbbmFtZV0gfHwgW107XG5cdFx0dGhpc1tuYW1lXS5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2suY2FsbChlbnYgJiYgZW52LmNvbnRleHQgPyBlbnYuY29udGV4dCA6IGVudiwgZW52KTtcblx0XHR9KTtcblx0fVxufVxuXG4vKipcbiAqIEBpbXBsZW1lbnRzIHtJUGx1Z2luc31cbiAqL1xuY2xhc3MgUGx1Z2lucyB7XG5cdGNvbnN0cnVjdG9yKGpzZXApIHtcblx0XHR0aGlzLmpzZXAgPSBqc2VwO1xuXHRcdHRoaXMucmVnaXN0ZXJlZCA9IHt9O1xuXHR9XG5cblx0LyoqXG5cdCAqIEBjYWxsYmFjayBQbHVnaW5TZXR1cFxuXHQgKiBAdGhpcyB7SnNlcH0ganNlcFxuXHQgKiBAcmV0dXJuczogdm9pZFxuXHQgKi9cblx0LyoqXG5cdCAqIEFkZHMgdGhlIGdpdmVuIHBsdWdpbihzKSB0byB0aGUgcmVnaXN0cnlcblx0ICpcblx0ICogQHBhcmFtIHtvYmplY3R9IHBsdWdpbnNcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBsdWdpbnMubmFtZSBUaGUgbmFtZSBvZiB0aGUgcGx1Z2luXG5cdCAqIEBwYXJhbSB7UGx1Z2luU2V0dXB9IHBsdWdpbnMuaW5pdCBUaGUgaW5pdCBmdW5jdGlvblxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRyZWdpc3RlciguLi5wbHVnaW5zKSB7XG5cdFx0cGx1Z2lucy5mb3JFYWNoKChwbHVnaW4pID0+IHtcblx0XHRcdGlmICh0eXBlb2YgcGx1Z2luICE9PSAnb2JqZWN0JyB8fCAhcGx1Z2luLm5hbWUgfHwgIXBsdWdpbi5pbml0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBKU0VQIHBsdWdpbiBmb3JtYXQnKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnJlZ2lzdGVyZWRbcGx1Z2luLm5hbWVdKSB7XG5cdFx0XHRcdC8vIGFscmVhZHkgcmVnaXN0ZXJlZC4gSWdub3JlLlxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRwbHVnaW4uaW5pdCh0aGlzLmpzZXApO1xuXHRcdFx0dGhpcy5yZWdpc3RlcmVkW3BsdWdpbi5uYW1lXSA9IHBsdWdpbjtcblx0XHR9KTtcblx0fVxufVxuXG4vLyAgICAgSmF2YVNjcmlwdCBFeHByZXNzaW9uIFBhcnNlciAoSlNFUCkgMS4zLjdcblxuY2xhc3MgSnNlcCB7XG5cdC8qKlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxuXHQgKi9cblx0c3RhdGljIGdldCB2ZXJzaW9uKCkge1xuXHRcdC8vIFRvIGJlIGZpbGxlZCBpbiBieSB0aGUgdGVtcGxhdGVcblx0XHRyZXR1cm4gJzEuMy43Jztcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxuXHQgKi9cblx0c3RhdGljIHRvU3RyaW5nKCkge1xuXHRcdHJldHVybiAnSmF2YVNjcmlwdCBFeHByZXNzaW9uIFBhcnNlciAoSlNFUCkgdicgKyBKc2VwLnZlcnNpb247XG5cdH07XG5cblx0Ly8gPT09PT09PT09PT09PT09PT09PT0gQ09ORklHID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdC8qKlxuXHQgKiBAbWV0aG9kIGFkZFVuYXJ5T3Bcblx0ICogQHBhcmFtIHtzdHJpbmd9IG9wX25hbWUgVGhlIG5hbWUgb2YgdGhlIHVuYXJ5IG9wIHRvIGFkZFxuXHQgKiBAcmV0dXJucyB7SnNlcH1cblx0ICovXG5cdHN0YXRpYyBhZGRVbmFyeU9wKG9wX25hbWUpIHtcblx0XHRKc2VwLm1heF91bm9wX2xlbiA9IE1hdGgubWF4KG9wX25hbWUubGVuZ3RoLCBKc2VwLm1heF91bm9wX2xlbik7XG5cdFx0SnNlcC51bmFyeV9vcHNbb3BfbmFtZV0gPSAxO1xuXHRcdHJldHVybiBKc2VwO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBtZXRob2QganNlcC5hZGRCaW5hcnlPcFxuXHQgKiBAcGFyYW0ge3N0cmluZ30gb3BfbmFtZSBUaGUgbmFtZSBvZiB0aGUgYmluYXJ5IG9wIHRvIGFkZFxuXHQgKiBAcGFyYW0ge251bWJlcn0gcHJlY2VkZW5jZSBUaGUgcHJlY2VkZW5jZSBvZiB0aGUgYmluYXJ5IG9wIChjYW4gYmUgYSBmbG9hdCkuIEhpZ2hlciBudW1iZXIgPSBoaWdoZXIgcHJlY2VkZW5jZVxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtpc1JpZ2h0QXNzb2NpYXRpdmU9ZmFsc2VdIHdoZXRoZXIgb3BlcmF0b3IgaXMgcmlnaHQtYXNzb2NpYXRpdmVcblx0ICogQHJldHVybnMge0pzZXB9XG5cdCAqL1xuXHRzdGF0aWMgYWRkQmluYXJ5T3Aob3BfbmFtZSwgcHJlY2VkZW5jZSwgaXNSaWdodEFzc29jaWF0aXZlKSB7XG5cdFx0SnNlcC5tYXhfYmlub3BfbGVuID0gTWF0aC5tYXgob3BfbmFtZS5sZW5ndGgsIEpzZXAubWF4X2Jpbm9wX2xlbik7XG5cdFx0SnNlcC5iaW5hcnlfb3BzW29wX25hbWVdID0gcHJlY2VkZW5jZTtcblx0XHRpZiAoaXNSaWdodEFzc29jaWF0aXZlKSB7XG5cdFx0XHRKc2VwLnJpZ2h0X2Fzc29jaWF0aXZlLmFkZChvcF9uYW1lKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRKc2VwLnJpZ2h0X2Fzc29jaWF0aXZlLmRlbGV0ZShvcF9uYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIEpzZXA7XG5cdH1cblxuXHQvKipcblx0ICogQG1ldGhvZCBhZGRJZGVudGlmaWVyQ2hhclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2hhciBUaGUgYWRkaXRpb25hbCBjaGFyYWN0ZXIgdG8gdHJlYXQgYXMgYSB2YWxpZCBwYXJ0IG9mIGFuIGlkZW50aWZpZXJcblx0ICogQHJldHVybnMge0pzZXB9XG5cdCAqL1xuXHRzdGF0aWMgYWRkSWRlbnRpZmllckNoYXIoY2hhcikge1xuXHRcdEpzZXAuYWRkaXRpb25hbF9pZGVudGlmaWVyX2NoYXJzLmFkZChjaGFyKTtcblx0XHRyZXR1cm4gSnNlcDtcblx0fVxuXG5cdC8qKlxuXHQgKiBAbWV0aG9kIGFkZExpdGVyYWxcblx0ICogQHBhcmFtIHtzdHJpbmd9IGxpdGVyYWxfbmFtZSBUaGUgbmFtZSBvZiB0aGUgbGl0ZXJhbCB0byBhZGRcblx0ICogQHBhcmFtIHsqfSBsaXRlcmFsX3ZhbHVlIFRoZSB2YWx1ZSBvZiB0aGUgbGl0ZXJhbFxuXHQgKiBAcmV0dXJucyB7SnNlcH1cblx0ICovXG5cdHN0YXRpYyBhZGRMaXRlcmFsKGxpdGVyYWxfbmFtZSwgbGl0ZXJhbF92YWx1ZSkge1xuXHRcdEpzZXAubGl0ZXJhbHNbbGl0ZXJhbF9uYW1lXSA9IGxpdGVyYWxfdmFsdWU7XG5cdFx0cmV0dXJuIEpzZXA7XG5cdH1cblxuXHQvKipcblx0ICogQG1ldGhvZCByZW1vdmVVbmFyeU9wXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBvcF9uYW1lIFRoZSBuYW1lIG9mIHRoZSB1bmFyeSBvcCB0byByZW1vdmVcblx0ICogQHJldHVybnMge0pzZXB9XG5cdCAqL1xuXHRzdGF0aWMgcmVtb3ZlVW5hcnlPcChvcF9uYW1lKSB7XG5cdFx0ZGVsZXRlIEpzZXAudW5hcnlfb3BzW29wX25hbWVdO1xuXHRcdGlmIChvcF9uYW1lLmxlbmd0aCA9PT0gSnNlcC5tYXhfdW5vcF9sZW4pIHtcblx0XHRcdEpzZXAubWF4X3Vub3BfbGVuID0gSnNlcC5nZXRNYXhLZXlMZW4oSnNlcC51bmFyeV9vcHMpO1xuXHRcdH1cblx0XHRyZXR1cm4gSnNlcDtcblx0fVxuXG5cdC8qKlxuXHQgKiBAbWV0aG9kIHJlbW92ZUFsbFVuYXJ5T3BzXG5cdCAqIEByZXR1cm5zIHtKc2VwfVxuXHQgKi9cblx0c3RhdGljIHJlbW92ZUFsbFVuYXJ5T3BzKCkge1xuXHRcdEpzZXAudW5hcnlfb3BzID0ge307XG5cdFx0SnNlcC5tYXhfdW5vcF9sZW4gPSAwO1xuXG5cdFx0cmV0dXJuIEpzZXA7XG5cdH1cblxuXHQvKipcblx0ICogQG1ldGhvZCByZW1vdmVJZGVudGlmaWVyQ2hhclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2hhciBUaGUgYWRkaXRpb25hbCBjaGFyYWN0ZXIgdG8gc3RvcCB0cmVhdGluZyBhcyBhIHZhbGlkIHBhcnQgb2YgYW4gaWRlbnRpZmllclxuXHQgKiBAcmV0dXJucyB7SnNlcH1cblx0ICovXG5cdHN0YXRpYyByZW1vdmVJZGVudGlmaWVyQ2hhcihjaGFyKSB7XG5cdFx0SnNlcC5hZGRpdGlvbmFsX2lkZW50aWZpZXJfY2hhcnMuZGVsZXRlKGNoYXIpO1xuXHRcdHJldHVybiBKc2VwO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBtZXRob2QgcmVtb3ZlQmluYXJ5T3Bcblx0ICogQHBhcmFtIHtzdHJpbmd9IG9wX25hbWUgVGhlIG5hbWUgb2YgdGhlIGJpbmFyeSBvcCB0byByZW1vdmVcblx0ICogQHJldHVybnMge0pzZXB9XG5cdCAqL1xuXHRzdGF0aWMgcmVtb3ZlQmluYXJ5T3Aob3BfbmFtZSkge1xuXHRcdGRlbGV0ZSBKc2VwLmJpbmFyeV9vcHNbb3BfbmFtZV07XG5cblx0XHRpZiAob3BfbmFtZS5sZW5ndGggPT09IEpzZXAubWF4X2Jpbm9wX2xlbikge1xuXHRcdFx0SnNlcC5tYXhfYmlub3BfbGVuID0gSnNlcC5nZXRNYXhLZXlMZW4oSnNlcC5iaW5hcnlfb3BzKTtcblx0XHR9XG5cdFx0SnNlcC5yaWdodF9hc3NvY2lhdGl2ZS5kZWxldGUob3BfbmFtZSk7XG5cblx0XHRyZXR1cm4gSnNlcDtcblx0fVxuXG5cdC8qKlxuXHQgKiBAbWV0aG9kIHJlbW92ZUFsbEJpbmFyeU9wc1xuXHQgKiBAcmV0dXJucyB7SnNlcH1cblx0ICovXG5cdHN0YXRpYyByZW1vdmVBbGxCaW5hcnlPcHMoKSB7XG5cdFx0SnNlcC5iaW5hcnlfb3BzID0ge307XG5cdFx0SnNlcC5tYXhfYmlub3BfbGVuID0gMDtcblxuXHRcdHJldHVybiBKc2VwO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBtZXRob2QgcmVtb3ZlTGl0ZXJhbFxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbGl0ZXJhbF9uYW1lIFRoZSBuYW1lIG9mIHRoZSBsaXRlcmFsIHRvIHJlbW92ZVxuXHQgKiBAcmV0dXJucyB7SnNlcH1cblx0ICovXG5cdHN0YXRpYyByZW1vdmVMaXRlcmFsKGxpdGVyYWxfbmFtZSkge1xuXHRcdGRlbGV0ZSBKc2VwLmxpdGVyYWxzW2xpdGVyYWxfbmFtZV07XG5cdFx0cmV0dXJuIEpzZXA7XG5cdH1cblxuXHQvKipcblx0ICogQG1ldGhvZCByZW1vdmVBbGxMaXRlcmFsc1xuXHQgKiBAcmV0dXJucyB7SnNlcH1cblx0ICovXG5cdHN0YXRpYyByZW1vdmVBbGxMaXRlcmFscygpIHtcblx0XHRKc2VwLmxpdGVyYWxzID0ge307XG5cblx0XHRyZXR1cm4gSnNlcDtcblx0fVxuXHQvLyA9PT09PT09PT09PT09PT09PT09PSBFTkQgQ09ORklHID09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxuXHQgKi9cblx0Z2V0IGNoYXIoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCk7XG5cdH1cblxuXHQvKipcblx0ICogQHJldHVybnMge251bWJlcn1cblx0ICovXG5cdGdldCBjb2RlKCkge1xuXHRcdHJldHVybiB0aGlzLmV4cHIuY2hhckNvZGVBdCh0aGlzLmluZGV4KTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZXhwciBhIHN0cmluZyB3aXRoIHRoZSBwYXNzZWQgaW4gZXhwcmVzc1xuXHQgKiBAcmV0dXJucyBKc2VwXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihleHByKSB7XG5cdFx0Ly8gYGluZGV4YCBzdG9yZXMgdGhlIGNoYXJhY3RlciBudW1iZXIgd2UgYXJlIGN1cnJlbnRseSBhdFxuXHRcdC8vIEFsbCBvZiB0aGUgZ29iYmxlcyBiZWxvdyB3aWxsIG1vZGlmeSBgaW5kZXhgIGFzIHdlIG1vdmUgYWxvbmdcblx0XHR0aGlzLmV4cHIgPSBleHByO1xuXHRcdHRoaXMuaW5kZXggPSAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIHN0YXRpYyB0b3AtbGV2ZWwgcGFyc2VyXG5cdCAqIEByZXR1cm5zIHtqc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRzdGF0aWMgcGFyc2UoZXhwcikge1xuXHRcdHJldHVybiAobmV3IEpzZXAoZXhwcikpLnBhcnNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBsb25nZXN0IGtleSBsZW5ndGggb2YgYW55IG9iamVjdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gb2JqXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9XG5cdCAqL1xuXHRzdGF0aWMgZ2V0TWF4S2V5TGVuKG9iaikge1xuXHRcdHJldHVybiBNYXRoLm1heCgwLCAuLi5PYmplY3Qua2V5cyhvYmopLm1hcChrID0+IGsubGVuZ3RoKSk7XG5cdH1cblxuXHQvKipcblx0ICogYGNoYCBpcyBhIGNoYXJhY3RlciBjb2RlIGluIHRoZSBuZXh0IHRocmVlIGZ1bmN0aW9uc1xuXHQgKiBAcGFyYW0ge251bWJlcn0gY2hcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRzdGF0aWMgaXNEZWNpbWFsRGlnaXQoY2gpIHtcblx0XHRyZXR1cm4gKGNoID49IDQ4ICYmIGNoIDw9IDU3KTsgLy8gMC4uLjlcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBwcmVjZWRlbmNlIG9mIGEgYmluYXJ5IG9wZXJhdG9yIG9yIGAwYCBpZiBpdCBpc24ndCBhIGJpbmFyeSBvcGVyYXRvci4gQ2FuIGJlIGZsb2F0LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gb3BfdmFsXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9XG5cdCAqL1xuXHRzdGF0aWMgYmluYXJ5UHJlY2VkZW5jZShvcF92YWwpIHtcblx0XHRyZXR1cm4gSnNlcC5iaW5hcnlfb3BzW29wX3ZhbF0gfHwgMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBMb29rcyBmb3Igc3RhcnQgb2YgaWRlbnRpZmllclxuXHQgKiBAcGFyYW0ge251bWJlcn0gY2hcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRzdGF0aWMgaXNJZGVudGlmaWVyU3RhcnQoY2gpIHtcblx0XHRyZXR1cm4gIChjaCA+PSA2NSAmJiBjaCA8PSA5MCkgfHwgLy8gQS4uLlpcblx0XHRcdChjaCA+PSA5NyAmJiBjaCA8PSAxMjIpIHx8IC8vIGEuLi56XG5cdFx0XHQoY2ggPj0gMTI4ICYmICFKc2VwLmJpbmFyeV9vcHNbU3RyaW5nLmZyb21DaGFyQ29kZShjaCldKSB8fCAvLyBhbnkgbm9uLUFTQ0lJIHRoYXQgaXMgbm90IGFuIG9wZXJhdG9yXG5cdFx0XHQoSnNlcC5hZGRpdGlvbmFsX2lkZW50aWZpZXJfY2hhcnMuaGFzKFN0cmluZy5mcm9tQ2hhckNvZGUoY2gpKSk7IC8vIGFkZGl0aW9uYWwgY2hhcmFjdGVyc1xuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBjaFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdHN0YXRpYyBpc0lkZW50aWZpZXJQYXJ0KGNoKSB7XG5cdFx0cmV0dXJuIEpzZXAuaXNJZGVudGlmaWVyU3RhcnQoY2gpIHx8IEpzZXAuaXNEZWNpbWFsRGlnaXQoY2gpO1xuXHR9XG5cblx0LyoqXG5cdCAqIHRocm93IGVycm9yIGF0IGluZGV4IG9mIHRoZSBleHByZXNzaW9uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlXG5cdCAqIEB0aHJvd3Ncblx0ICovXG5cdHRocm93RXJyb3IobWVzc2FnZSkge1xuXHRcdGNvbnN0IGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UgKyAnIGF0IGNoYXJhY3RlciAnICsgdGhpcy5pbmRleCk7XG5cdFx0ZXJyb3IuaW5kZXggPSB0aGlzLmluZGV4O1xuXHRcdGVycm9yLmRlc2NyaXB0aW9uID0gbWVzc2FnZTtcblx0XHR0aHJvdyBlcnJvcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSdW4gYSBnaXZlbiBob29rXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lXG5cdCAqIEBwYXJhbSB7anNlcC5FeHByZXNzaW9ufGZhbHNlfSBbbm9kZV1cblx0ICogQHJldHVybnMgez9qc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRydW5Ib29rKG5hbWUsIG5vZGUpIHtcblx0XHRpZiAoSnNlcC5ob29rc1tuYW1lXSkge1xuXHRcdFx0Y29uc3QgZW52ID0geyBjb250ZXh0OiB0aGlzLCBub2RlIH07XG5cdFx0XHRKc2VwLmhvb2tzLnJ1bihuYW1lLCBlbnYpO1xuXHRcdFx0cmV0dXJuIGVudi5ub2RlO1xuXHRcdH1cblx0XHRyZXR1cm4gbm9kZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSdW5zIGEgZ2l2ZW4gaG9vayB1bnRpbCBvbmUgcmV0dXJucyBhIG5vZGVcblx0ICogQHBhcmFtIHtzdHJpbmd9IG5hbWVcblx0ICogQHJldHVybnMgez9qc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRzZWFyY2hIb29rKG5hbWUpIHtcblx0XHRpZiAoSnNlcC5ob29rc1tuYW1lXSkge1xuXHRcdFx0Y29uc3QgZW52ID0geyBjb250ZXh0OiB0aGlzIH07XG5cdFx0XHRKc2VwLmhvb2tzW25hbWVdLmZpbmQoZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG5cdFx0XHRcdGNhbGxiYWNrLmNhbGwoZW52LmNvbnRleHQsIGVudik7XG5cdFx0XHRcdHJldHVybiBlbnYubm9kZTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGVudi5ub2RlO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBQdXNoIGBpbmRleGAgdXAgdG8gdGhlIG5leHQgbm9uLXNwYWNlIGNoYXJhY3RlclxuXHQgKi9cblx0Z29iYmxlU3BhY2VzKCkge1xuXHRcdGxldCBjaCA9IHRoaXMuY29kZTtcblx0XHQvLyBXaGl0ZXNwYWNlXG5cdFx0d2hpbGUgKGNoID09PSBKc2VwLlNQQUNFX0NPREVcblx0XHR8fCBjaCA9PT0gSnNlcC5UQUJfQ09ERVxuXHRcdHx8IGNoID09PSBKc2VwLkxGX0NPREVcblx0XHR8fCBjaCA9PT0gSnNlcC5DUl9DT0RFKSB7XG5cdFx0XHRjaCA9IHRoaXMuZXhwci5jaGFyQ29kZUF0KCsrdGhpcy5pbmRleCk7XG5cdFx0fVxuXHRcdHRoaXMucnVuSG9vaygnZ29iYmxlLXNwYWNlcycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRvcC1sZXZlbCBtZXRob2QgdG8gcGFyc2UgYWxsIGV4cHJlc3Npb25zIGFuZCByZXR1cm5zIGNvbXBvdW5kIG9yIHNpbmdsZSBub2RlXG5cdCAqIEByZXR1cm5zIHtqc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRwYXJzZSgpIHtcblx0XHR0aGlzLnJ1bkhvb2soJ2JlZm9yZS1hbGwnKTtcblx0XHRjb25zdCBub2RlcyA9IHRoaXMuZ29iYmxlRXhwcmVzc2lvbnMoKTtcblxuXHRcdC8vIElmIHRoZXJlJ3Mgb25seSBvbmUgZXhwcmVzc2lvbiBqdXN0IHRyeSByZXR1cm5pbmcgdGhlIGV4cHJlc3Npb25cblx0XHRjb25zdCBub2RlID0gbm9kZXMubGVuZ3RoID09PSAxXG5cdFx0ICA/IG5vZGVzWzBdXG5cdFx0XHQ6IHtcblx0XHRcdFx0dHlwZTogSnNlcC5DT01QT1VORCxcblx0XHRcdFx0Ym9keTogbm9kZXNcblx0XHRcdH07XG5cdFx0cmV0dXJuIHRoaXMucnVuSG9vaygnYWZ0ZXItYWxsJywgbm9kZSk7XG5cdH1cblxuXHQvKipcblx0ICogdG9wLWxldmVsIHBhcnNlciAoYnV0IGNhbiBiZSByZXVzZWQgd2l0aGluIGFzIHdlbGwpXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBbdW50aWxJQ29kZV1cblx0ICogQHJldHVybnMge2pzZXAuRXhwcmVzc2lvbltdfVxuXHQgKi9cblx0Z29iYmxlRXhwcmVzc2lvbnModW50aWxJQ29kZSkge1xuXHRcdGxldCBub2RlcyA9IFtdLCBjaF9pLCBub2RlO1xuXG5cdFx0d2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLmV4cHIubGVuZ3RoKSB7XG5cdFx0XHRjaF9pID0gdGhpcy5jb2RlO1xuXG5cdFx0XHQvLyBFeHByZXNzaW9ucyBjYW4gYmUgc2VwYXJhdGVkIGJ5IHNlbWljb2xvbnMsIGNvbW1hcywgb3IganVzdCBpbmZlcnJlZCB3aXRob3V0IGFueVxuXHRcdFx0Ly8gc2VwYXJhdG9yc1xuXHRcdFx0aWYgKGNoX2kgPT09IEpzZXAuU0VNQ09MX0NPREUgfHwgY2hfaSA9PT0gSnNlcC5DT01NQV9DT0RFKSB7XG5cdFx0XHRcdHRoaXMuaW5kZXgrKzsgLy8gaWdub3JlIHNlcGFyYXRvcnNcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHQvLyBUcnkgdG8gZ29iYmxlIGVhY2ggZXhwcmVzc2lvbiBpbmRpdmlkdWFsbHlcblx0XHRcdFx0aWYgKG5vZGUgPSB0aGlzLmdvYmJsZUV4cHJlc3Npb24oKSkge1xuXHRcdFx0XHRcdG5vZGVzLnB1c2gobm9kZSk7XG5cdFx0XHRcdFx0Ly8gSWYgd2Ugd2VyZW4ndCBhYmxlIHRvIGZpbmQgYSBiaW5hcnkgZXhwcmVzc2lvbiBhbmQgYXJlIG91dCBvZiByb29tLCB0aGVuXG5cdFx0XHRcdFx0Ly8gdGhlIGV4cHJlc3Npb24gcGFzc2VkIGluIHByb2JhYmx5IGhhcyB0b28gbXVjaFxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKHRoaXMuaW5kZXggPCB0aGlzLmV4cHIubGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKGNoX2kgPT09IHVudGlsSUNvZGUpIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnRocm93RXJyb3IoJ1VuZXhwZWN0ZWQgXCInICsgdGhpcy5jaGFyICsgJ1wiJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbm9kZXM7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIG1haW4gcGFyc2luZyBmdW5jdGlvbi5cblx0ICogQHJldHVybnMgez9qc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRnb2JibGVFeHByZXNzaW9uKCkge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLnNlYXJjaEhvb2soJ2dvYmJsZS1leHByZXNzaW9uJykgfHwgdGhpcy5nb2JibGVCaW5hcnlFeHByZXNzaW9uKCk7XG5cdFx0dGhpcy5nb2JibGVTcGFjZXMoKTtcblxuXHRcdHJldHVybiB0aGlzLnJ1bkhvb2soJ2FmdGVyLWV4cHJlc3Npb24nLCBub2RlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZWFyY2ggZm9yIHRoZSBvcGVyYXRpb24gcG9ydGlvbiBvZiB0aGUgc3RyaW5nIChlLmcuIGArYCwgYD09PWApXG5cdCAqIFN0YXJ0IGJ5IHRha2luZyB0aGUgbG9uZ2VzdCBwb3NzaWJsZSBiaW5hcnkgb3BlcmF0aW9ucyAoMyBjaGFyYWN0ZXJzOiBgPT09YCwgYCE9PWAsIGA+Pj5gKVxuXHQgKiBhbmQgbW92ZSBkb3duIGZyb20gMyB0byAyIHRvIDEgY2hhcmFjdGVyIHVudGlsIGEgbWF0Y2hpbmcgYmluYXJ5IG9wZXJhdGlvbiBpcyBmb3VuZFxuXHQgKiB0aGVuLCByZXR1cm4gdGhhdCBiaW5hcnkgb3BlcmF0aW9uXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd8Ym9vbGVhbn1cblx0ICovXG5cdGdvYmJsZUJpbmFyeU9wKCkge1xuXHRcdHRoaXMuZ29iYmxlU3BhY2VzKCk7XG5cdFx0bGV0IHRvX2NoZWNrID0gdGhpcy5leHByLnN1YnN0cih0aGlzLmluZGV4LCBKc2VwLm1heF9iaW5vcF9sZW4pO1xuXHRcdGxldCB0Y19sZW4gPSB0b19jaGVjay5sZW5ndGg7XG5cblx0XHR3aGlsZSAodGNfbGVuID4gMCkge1xuXHRcdFx0Ly8gRG9uJ3QgYWNjZXB0IGEgYmluYXJ5IG9wIHdoZW4gaXQgaXMgYW4gaWRlbnRpZmllci5cblx0XHRcdC8vIEJpbmFyeSBvcHMgdGhhdCBzdGFydCB3aXRoIGEgaWRlbnRpZmllci12YWxpZCBjaGFyYWN0ZXIgbXVzdCBiZSBmb2xsb3dlZFxuXHRcdFx0Ly8gYnkgYSBub24gaWRlbnRpZmllci1wYXJ0IHZhbGlkIGNoYXJhY3RlclxuXHRcdFx0aWYgKEpzZXAuYmluYXJ5X29wcy5oYXNPd25Qcm9wZXJ0eSh0b19jaGVjaykgJiYgKFxuXHRcdFx0XHQhSnNlcC5pc0lkZW50aWZpZXJTdGFydCh0aGlzLmNvZGUpIHx8XG5cdFx0XHRcdCh0aGlzLmluZGV4ICsgdG9fY2hlY2subGVuZ3RoIDwgdGhpcy5leHByLmxlbmd0aCAmJiAhSnNlcC5pc0lkZW50aWZpZXJQYXJ0KHRoaXMuZXhwci5jaGFyQ29kZUF0KHRoaXMuaW5kZXggKyB0b19jaGVjay5sZW5ndGgpKSlcblx0XHRcdCkpIHtcblx0XHRcdFx0dGhpcy5pbmRleCArPSB0Y19sZW47XG5cdFx0XHRcdHJldHVybiB0b19jaGVjaztcblx0XHRcdH1cblx0XHRcdHRvX2NoZWNrID0gdG9fY2hlY2suc3Vic3RyKDAsIC0tdGNfbGVuKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoaXMgZnVuY3Rpb24gaXMgcmVzcG9uc2libGUgZm9yIGdvYmJsaW5nIGFuIGluZGl2aWR1YWwgZXhwcmVzc2lvbixcblx0ICogZS5nLiBgMWAsIGAxKzJgLCBgYSsoYioyKS1NYXRoLnNxcnQoMilgXG5cdCAqIEByZXR1cm5zIHs/anNlcC5CaW5hcnlFeHByZXNzaW9ufVxuXHQgKi9cblx0Z29iYmxlQmluYXJ5RXhwcmVzc2lvbigpIHtcblx0XHRsZXQgbm9kZSwgYmlvcCwgcHJlYywgc3RhY2ssIGJpb3BfaW5mbywgbGVmdCwgcmlnaHQsIGksIGN1cl9iaW9wO1xuXG5cdFx0Ly8gRmlyc3QsIHRyeSB0byBnZXQgdGhlIGxlZnRtb3N0IHRoaW5nXG5cdFx0Ly8gVGhlbiwgY2hlY2sgdG8gc2VlIGlmIHRoZXJlJ3MgYSBiaW5hcnkgb3BlcmF0b3Igb3BlcmF0aW5nIG9uIHRoYXQgbGVmdG1vc3QgdGhpbmdcblx0XHQvLyBEb24ndCBnb2JibGVCaW5hcnlPcCB3aXRob3V0IGEgbGVmdC1oYW5kLXNpZGVcblx0XHRsZWZ0ID0gdGhpcy5nb2JibGVUb2tlbigpO1xuXHRcdGlmICghbGVmdCkge1xuXHRcdFx0cmV0dXJuIGxlZnQ7XG5cdFx0fVxuXHRcdGJpb3AgPSB0aGlzLmdvYmJsZUJpbmFyeU9wKCk7XG5cblx0XHQvLyBJZiB0aGVyZSB3YXNuJ3QgYSBiaW5hcnkgb3BlcmF0b3IsIGp1c3QgcmV0dXJuIHRoZSBsZWZ0bW9zdCBub2RlXG5cdFx0aWYgKCFiaW9wKSB7XG5cdFx0XHRyZXR1cm4gbGVmdDtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UsIHdlIG5lZWQgdG8gc3RhcnQgYSBzdGFjayB0byBwcm9wZXJseSBwbGFjZSB0aGUgYmluYXJ5IG9wZXJhdGlvbnMgaW4gdGhlaXJcblx0XHQvLyBwcmVjZWRlbmNlIHN0cnVjdHVyZVxuXHRcdGJpb3BfaW5mbyA9IHsgdmFsdWU6IGJpb3AsIHByZWM6IEpzZXAuYmluYXJ5UHJlY2VkZW5jZShiaW9wKSwgcmlnaHRfYTogSnNlcC5yaWdodF9hc3NvY2lhdGl2ZS5oYXMoYmlvcCkgfTtcblxuXHRcdHJpZ2h0ID0gdGhpcy5nb2JibGVUb2tlbigpO1xuXG5cdFx0aWYgKCFyaWdodCkge1xuXHRcdFx0dGhpcy50aHJvd0Vycm9yKFwiRXhwZWN0ZWQgZXhwcmVzc2lvbiBhZnRlciBcIiArIGJpb3ApO1xuXHRcdH1cblxuXHRcdHN0YWNrID0gW2xlZnQsIGJpb3BfaW5mbywgcmlnaHRdO1xuXG5cdFx0Ly8gUHJvcGVybHkgZGVhbCB3aXRoIHByZWNlZGVuY2UgdXNpbmcgW3JlY3Vyc2l2ZSBkZXNjZW50XShodHRwOi8vd3d3LmVuZ3IubXVuLmNhL350aGVvL01pc2MvZXhwX3BhcnNpbmcuaHRtKVxuXHRcdHdoaWxlICgoYmlvcCA9IHRoaXMuZ29iYmxlQmluYXJ5T3AoKSkpIHtcblx0XHRcdHByZWMgPSBKc2VwLmJpbmFyeVByZWNlZGVuY2UoYmlvcCk7XG5cblx0XHRcdGlmIChwcmVjID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuaW5kZXggLT0gYmlvcC5sZW5ndGg7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRiaW9wX2luZm8gPSB7IHZhbHVlOiBiaW9wLCBwcmVjLCByaWdodF9hOiBKc2VwLnJpZ2h0X2Fzc29jaWF0aXZlLmhhcyhiaW9wKSB9O1xuXG5cdFx0XHRjdXJfYmlvcCA9IGJpb3A7XG5cblx0XHRcdC8vIFJlZHVjZTogbWFrZSBhIGJpbmFyeSBleHByZXNzaW9uIGZyb20gdGhlIHRocmVlIHRvcG1vc3QgZW50cmllcy5cblx0XHRcdGNvbnN0IGNvbXBhcmVQcmV2ID0gcHJldiA9PiBiaW9wX2luZm8ucmlnaHRfYSAmJiBwcmV2LnJpZ2h0X2Fcblx0XHRcdFx0PyBwcmVjID4gcHJldi5wcmVjXG5cdFx0XHRcdDogcHJlYyA8PSBwcmV2LnByZWM7XG5cdFx0XHR3aGlsZSAoKHN0YWNrLmxlbmd0aCA+IDIpICYmIGNvbXBhcmVQcmV2KHN0YWNrW3N0YWNrLmxlbmd0aCAtIDJdKSkge1xuXHRcdFx0XHRyaWdodCA9IHN0YWNrLnBvcCgpO1xuXHRcdFx0XHRiaW9wID0gc3RhY2sucG9wKCkudmFsdWU7XG5cdFx0XHRcdGxlZnQgPSBzdGFjay5wb3AoKTtcblx0XHRcdFx0bm9kZSA9IHtcblx0XHRcdFx0XHR0eXBlOiBKc2VwLkJJTkFSWV9FWFAsXG5cdFx0XHRcdFx0b3BlcmF0b3I6IGJpb3AsXG5cdFx0XHRcdFx0bGVmdCxcblx0XHRcdFx0XHRyaWdodFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRzdGFjay5wdXNoKG5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlID0gdGhpcy5nb2JibGVUb2tlbigpO1xuXG5cdFx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdFx0dGhpcy50aHJvd0Vycm9yKFwiRXhwZWN0ZWQgZXhwcmVzc2lvbiBhZnRlciBcIiArIGN1cl9iaW9wKTtcblx0XHRcdH1cblxuXHRcdFx0c3RhY2sucHVzaChiaW9wX2luZm8sIG5vZGUpO1xuXHRcdH1cblxuXHRcdGkgPSBzdGFjay5sZW5ndGggLSAxO1xuXHRcdG5vZGUgPSBzdGFja1tpXTtcblxuXHRcdHdoaWxlIChpID4gMSkge1xuXHRcdFx0bm9kZSA9IHtcblx0XHRcdFx0dHlwZTogSnNlcC5CSU5BUllfRVhQLFxuXHRcdFx0XHRvcGVyYXRvcjogc3RhY2tbaSAtIDFdLnZhbHVlLFxuXHRcdFx0XHRsZWZ0OiBzdGFja1tpIC0gMl0sXG5cdFx0XHRcdHJpZ2h0OiBub2RlXG5cdFx0XHR9O1xuXHRcdFx0aSAtPSAyO1xuXHRcdH1cblxuXHRcdHJldHVybiBub2RlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFuIGluZGl2aWR1YWwgcGFydCBvZiBhIGJpbmFyeSBleHByZXNzaW9uOlxuXHQgKiBlLmcuIGBmb28uYmFyKGJheilgLCBgMWAsIGBcImFiY1wiYCwgYChhICUgMilgIChiZWNhdXNlIGl0J3MgaW4gcGFyZW50aGVzaXMpXG5cdCAqIEByZXR1cm5zIHtib29sZWFufGpzZXAuRXhwcmVzc2lvbn1cblx0ICovXG5cdGdvYmJsZVRva2VuKCkge1xuXHRcdGxldCBjaCwgdG9fY2hlY2ssIHRjX2xlbiwgbm9kZTtcblxuXHRcdHRoaXMuZ29iYmxlU3BhY2VzKCk7XG5cdFx0bm9kZSA9IHRoaXMuc2VhcmNoSG9vaygnZ29iYmxlLXRva2VuJyk7XG5cdFx0aWYgKG5vZGUpIHtcblx0XHRcdHJldHVybiB0aGlzLnJ1bkhvb2soJ2FmdGVyLXRva2VuJywgbm9kZSk7XG5cdFx0fVxuXG5cdFx0Y2ggPSB0aGlzLmNvZGU7XG5cblx0XHRpZiAoSnNlcC5pc0RlY2ltYWxEaWdpdChjaCkgfHwgY2ggPT09IEpzZXAuUEVSSU9EX0NPREUpIHtcblx0XHRcdC8vIENoYXIgY29kZSA0NiBpcyBhIGRvdCBgLmAgd2hpY2ggY2FuIHN0YXJ0IG9mZiBhIG51bWVyaWMgbGl0ZXJhbFxuXHRcdFx0cmV0dXJuIHRoaXMuZ29iYmxlTnVtZXJpY0xpdGVyYWwoKTtcblx0XHR9XG5cblx0XHRpZiAoY2ggPT09IEpzZXAuU1FVT1RFX0NPREUgfHwgY2ggPT09IEpzZXAuRFFVT1RFX0NPREUpIHtcblx0XHRcdC8vIFNpbmdsZSBvciBkb3VibGUgcXVvdGVzXG5cdFx0XHRub2RlID0gdGhpcy5nb2JibGVTdHJpbmdMaXRlcmFsKCk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGNoID09PSBKc2VwLk9CUkFDS19DT0RFKSB7XG5cdFx0XHRub2RlID0gdGhpcy5nb2JibGVBcnJheSgpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRvX2NoZWNrID0gdGhpcy5leHByLnN1YnN0cih0aGlzLmluZGV4LCBKc2VwLm1heF91bm9wX2xlbik7XG5cdFx0XHR0Y19sZW4gPSB0b19jaGVjay5sZW5ndGg7XG5cblx0XHRcdHdoaWxlICh0Y19sZW4gPiAwKSB7XG5cdFx0XHRcdC8vIERvbid0IGFjY2VwdCBhbiB1bmFyeSBvcCB3aGVuIGl0IGlzIGFuIGlkZW50aWZpZXIuXG5cdFx0XHRcdC8vIFVuYXJ5IG9wcyB0aGF0IHN0YXJ0IHdpdGggYSBpZGVudGlmaWVyLXZhbGlkIGNoYXJhY3RlciBtdXN0IGJlIGZvbGxvd2VkXG5cdFx0XHRcdC8vIGJ5IGEgbm9uIGlkZW50aWZpZXItcGFydCB2YWxpZCBjaGFyYWN0ZXJcblx0XHRcdFx0aWYgKEpzZXAudW5hcnlfb3BzLmhhc093blByb3BlcnR5KHRvX2NoZWNrKSAmJiAoXG5cdFx0XHRcdFx0IUpzZXAuaXNJZGVudGlmaWVyU3RhcnQodGhpcy5jb2RlKSB8fFxuXHRcdFx0XHRcdCh0aGlzLmluZGV4ICsgdG9fY2hlY2subGVuZ3RoIDwgdGhpcy5leHByLmxlbmd0aCAmJiAhSnNlcC5pc0lkZW50aWZpZXJQYXJ0KHRoaXMuZXhwci5jaGFyQ29kZUF0KHRoaXMuaW5kZXggKyB0b19jaGVjay5sZW5ndGgpKSlcblx0XHRcdFx0KSkge1xuXHRcdFx0XHRcdHRoaXMuaW5kZXggKz0gdGNfbGVuO1xuXHRcdFx0XHRcdGNvbnN0IGFyZ3VtZW50ID0gdGhpcy5nb2JibGVUb2tlbigpO1xuXHRcdFx0XHRcdGlmICghYXJndW1lbnQpIHtcblx0XHRcdFx0XHRcdHRoaXMudGhyb3dFcnJvcignbWlzc2luZyB1bmFyeU9wIGFyZ3VtZW50Jyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnJ1bkhvb2soJ2FmdGVyLXRva2VuJywge1xuXHRcdFx0XHRcdFx0dHlwZTogSnNlcC5VTkFSWV9FWFAsXG5cdFx0XHRcdFx0XHRvcGVyYXRvcjogdG9fY2hlY2ssXG5cdFx0XHRcdFx0XHRhcmd1bWVudCxcblx0XHRcdFx0XHRcdHByZWZpeDogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dG9fY2hlY2sgPSB0b19jaGVjay5zdWJzdHIoMCwgLS10Y19sZW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoSnNlcC5pc0lkZW50aWZpZXJTdGFydChjaCkpIHtcblx0XHRcdFx0bm9kZSA9IHRoaXMuZ29iYmxlSWRlbnRpZmllcigpO1xuXHRcdFx0XHRpZiAoSnNlcC5saXRlcmFscy5oYXNPd25Qcm9wZXJ0eShub2RlLm5hbWUpKSB7XG5cdFx0XHRcdFx0bm9kZSA9IHtcblx0XHRcdFx0XHRcdHR5cGU6IEpzZXAuTElURVJBTCxcblx0XHRcdFx0XHRcdHZhbHVlOiBKc2VwLmxpdGVyYWxzW25vZGUubmFtZV0sXG5cdFx0XHRcdFx0XHRyYXc6IG5vZGUubmFtZSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKG5vZGUubmFtZSA9PT0gSnNlcC50aGlzX3N0cikge1xuXHRcdFx0XHRcdG5vZGUgPSB7IHR5cGU6IEpzZXAuVEhJU19FWFAgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2ggPT09IEpzZXAuT1BBUkVOX0NPREUpIHsgLy8gb3BlbiBwYXJlbnRoZXNpc1xuXHRcdFx0XHRub2RlID0gdGhpcy5nb2JibGVHcm91cCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucnVuSG9vaygnYWZ0ZXItdG9rZW4nLCBmYWxzZSk7XG5cdFx0fVxuXG5cdFx0bm9kZSA9IHRoaXMuZ29iYmxlVG9rZW5Qcm9wZXJ0eShub2RlKTtcblx0XHRyZXR1cm4gdGhpcy5ydW5Ib29rKCdhZnRlci10b2tlbicsIG5vZGUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdvYmJsZSBwcm9wZXJ0aWVzIG9mIG9mIGlkZW50aWZpZXJzL3N0cmluZ3MvYXJyYXlzL2dyb3Vwcy5cblx0ICogZS5nLiBgZm9vYCwgYGJhci5iYXpgLCBgZm9vWydiYXInXS5iYXpgXG5cdCAqIEl0IGFsc28gZ29iYmxlcyBmdW5jdGlvbiBjYWxsczpcblx0ICogZS5nLiBgTWF0aC5hY29zKG9iai5hbmdsZSlgXG5cdCAqIEBwYXJhbSB7anNlcC5FeHByZXNzaW9ufSBub2RlXG5cdCAqIEByZXR1cm5zIHtqc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRnb2JibGVUb2tlblByb3BlcnR5KG5vZGUpIHtcblx0XHR0aGlzLmdvYmJsZVNwYWNlcygpO1xuXG5cdFx0bGV0IGNoID0gdGhpcy5jb2RlO1xuXHRcdHdoaWxlIChjaCA9PT0gSnNlcC5QRVJJT0RfQ09ERSB8fCBjaCA9PT0gSnNlcC5PQlJBQ0tfQ09ERSB8fCBjaCA9PT0gSnNlcC5PUEFSRU5fQ09ERSB8fCBjaCA9PT0gSnNlcC5RVU1BUktfQ09ERSkge1xuXHRcdFx0bGV0IG9wdGlvbmFsO1xuXHRcdFx0aWYgKGNoID09PSBKc2VwLlFVTUFSS19DT0RFKSB7XG5cdFx0XHRcdGlmICh0aGlzLmV4cHIuY2hhckNvZGVBdCh0aGlzLmluZGV4ICsgMSkgIT09IEpzZXAuUEVSSU9EX0NPREUpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRvcHRpb25hbCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuaW5kZXggKz0gMjtcblx0XHRcdFx0dGhpcy5nb2JibGVTcGFjZXMoKTtcblx0XHRcdFx0Y2ggPSB0aGlzLmNvZGU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmluZGV4Kys7XG5cblx0XHRcdGlmIChjaCA9PT0gSnNlcC5PQlJBQ0tfQ09ERSkge1xuXHRcdFx0XHRub2RlID0ge1xuXHRcdFx0XHRcdHR5cGU6IEpzZXAuTUVNQkVSX0VYUCxcblx0XHRcdFx0XHRjb21wdXRlZDogdHJ1ZSxcblx0XHRcdFx0XHRvYmplY3Q6IG5vZGUsXG5cdFx0XHRcdFx0cHJvcGVydHk6IHRoaXMuZ29iYmxlRXhwcmVzc2lvbigpXG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMuZ29iYmxlU3BhY2VzKCk7XG5cdFx0XHRcdGNoID0gdGhpcy5jb2RlO1xuXHRcdFx0XHRpZiAoY2ggIT09IEpzZXAuQ0JSQUNLX0NPREUpIHtcblx0XHRcdFx0XHR0aGlzLnRocm93RXJyb3IoJ1VuY2xvc2VkIFsnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmluZGV4Kys7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjaCA9PT0gSnNlcC5PUEFSRU5fQ09ERSkge1xuXHRcdFx0XHQvLyBBIGZ1bmN0aW9uIGNhbGwgaXMgYmVpbmcgbWFkZTsgZ29iYmxlIGFsbCB0aGUgYXJndW1lbnRzXG5cdFx0XHRcdG5vZGUgPSB7XG5cdFx0XHRcdFx0dHlwZTogSnNlcC5DQUxMX0VYUCxcblx0XHRcdFx0XHQnYXJndW1lbnRzJzogdGhpcy5nb2JibGVBcmd1bWVudHMoSnNlcC5DUEFSRU5fQ09ERSksXG5cdFx0XHRcdFx0Y2FsbGVlOiBub2RlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjaCA9PT0gSnNlcC5QRVJJT0RfQ09ERSB8fCBvcHRpb25hbCkge1xuXHRcdFx0XHRpZiAob3B0aW9uYWwpIHtcblx0XHRcdFx0XHR0aGlzLmluZGV4LS07XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5nb2JibGVTcGFjZXMoKTtcblx0XHRcdFx0bm9kZSA9IHtcblx0XHRcdFx0XHR0eXBlOiBKc2VwLk1FTUJFUl9FWFAsXG5cdFx0XHRcdFx0Y29tcHV0ZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdG9iamVjdDogbm9kZSxcblx0XHRcdFx0XHRwcm9wZXJ0eTogdGhpcy5nb2JibGVJZGVudGlmaWVyKCksXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvcHRpb25hbCkge1xuXHRcdFx0XHRub2RlLm9wdGlvbmFsID0gdHJ1ZTtcblx0XHRcdH0gLy8gZWxzZSBsZWF2ZSB1bmRlZmluZWQgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBlc3ByaW1hXG5cblx0XHRcdHRoaXMuZ29iYmxlU3BhY2VzKCk7XG5cdFx0XHRjaCA9IHRoaXMuY29kZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbm9kZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQYXJzZSBzaW1wbGUgbnVtZXJpYyBsaXRlcmFsczogYDEyYCwgYDMuNGAsIGAuNWAuIERvIHRoaXMgYnkgdXNpbmcgYSBzdHJpbmcgdG9cblx0ICoga2VlcCB0cmFjayBvZiBldmVyeXRoaW5nIGluIHRoZSBudW1lcmljIGxpdGVyYWwgYW5kIHRoZW4gY2FsbGluZyBgcGFyc2VGbG9hdGAgb24gdGhhdCBzdHJpbmdcblx0ICogQHJldHVybnMge2pzZXAuTGl0ZXJhbH1cblx0ICovXG5cdGdvYmJsZU51bWVyaWNMaXRlcmFsKCkge1xuXHRcdGxldCBudW1iZXIgPSAnJywgY2gsIGNoQ29kZTtcblxuXHRcdHdoaWxlIChKc2VwLmlzRGVjaW1hbERpZ2l0KHRoaXMuY29kZSkpIHtcblx0XHRcdG51bWJlciArPSB0aGlzLmV4cHIuY2hhckF0KHRoaXMuaW5kZXgrKyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29kZSA9PT0gSnNlcC5QRVJJT0RfQ09ERSkgeyAvLyBjYW4gc3RhcnQgd2l0aCBhIGRlY2ltYWwgbWFya2VyXG5cdFx0XHRudW1iZXIgKz0gdGhpcy5leHByLmNoYXJBdCh0aGlzLmluZGV4KyspO1xuXG5cdFx0XHR3aGlsZSAoSnNlcC5pc0RlY2ltYWxEaWdpdCh0aGlzLmNvZGUpKSB7XG5cdFx0XHRcdG51bWJlciArPSB0aGlzLmV4cHIuY2hhckF0KHRoaXMuaW5kZXgrKyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y2ggPSB0aGlzLmNoYXI7XG5cblx0XHRpZiAoY2ggPT09ICdlJyB8fCBjaCA9PT0gJ0UnKSB7IC8vIGV4cG9uZW50IG1hcmtlclxuXHRcdFx0bnVtYmVyICs9IHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCsrKTtcblx0XHRcdGNoID0gdGhpcy5jaGFyO1xuXG5cdFx0XHRpZiAoY2ggPT09ICcrJyB8fCBjaCA9PT0gJy0nKSB7IC8vIGV4cG9uZW50IHNpZ25cblx0XHRcdFx0bnVtYmVyICs9IHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCsrKTtcblx0XHRcdH1cblxuXHRcdFx0d2hpbGUgKEpzZXAuaXNEZWNpbWFsRGlnaXQodGhpcy5jb2RlKSkgeyAvLyBleHBvbmVudCBpdHNlbGZcblx0XHRcdFx0bnVtYmVyICs9IHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCsrKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFKc2VwLmlzRGVjaW1hbERpZ2l0KHRoaXMuZXhwci5jaGFyQ29kZUF0KHRoaXMuaW5kZXggLSAxKSkgKSB7XG5cdFx0XHRcdHRoaXMudGhyb3dFcnJvcignRXhwZWN0ZWQgZXhwb25lbnQgKCcgKyBudW1iZXIgKyB0aGlzLmNoYXIgKyAnKScpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNoQ29kZSA9IHRoaXMuY29kZTtcblxuXHRcdC8vIENoZWNrIHRvIG1ha2Ugc3VyZSB0aGlzIGlzbid0IGEgdmFyaWFibGUgbmFtZSB0aGF0IHN0YXJ0IHdpdGggYSBudW1iZXIgKDEyM2FiYylcblx0XHRpZiAoSnNlcC5pc0lkZW50aWZpZXJTdGFydChjaENvZGUpKSB7XG5cdFx0XHR0aGlzLnRocm93RXJyb3IoJ1ZhcmlhYmxlIG5hbWVzIGNhbm5vdCBzdGFydCB3aXRoIGEgbnVtYmVyICgnICtcblx0XHRcdFx0bnVtYmVyICsgdGhpcy5jaGFyICsgJyknKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoY2hDb2RlID09PSBKc2VwLlBFUklPRF9DT0RFIHx8IChudW1iZXIubGVuZ3RoID09PSAxICYmIG51bWJlci5jaGFyQ29kZUF0KDApID09PSBKc2VwLlBFUklPRF9DT0RFKSkge1xuXHRcdFx0dGhpcy50aHJvd0Vycm9yKCdVbmV4cGVjdGVkIHBlcmlvZCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiBKc2VwLkxJVEVSQUwsXG5cdFx0XHR2YWx1ZTogcGFyc2VGbG9hdChudW1iZXIpLFxuXHRcdFx0cmF3OiBudW1iZXJcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFBhcnNlcyBhIHN0cmluZyBsaXRlcmFsLCBzdGFyaW5nIHdpdGggc2luZ2xlIG9yIGRvdWJsZSBxdW90ZXMgd2l0aCBiYXNpYyBzdXBwb3J0IGZvciBlc2NhcGUgY29kZXNcblx0ICogZS5nLiBgXCJoZWxsbyB3b3JsZFwiYCwgYCd0aGlzIGlzXFxuSlNFUCdgXG5cdCAqIEByZXR1cm5zIHtqc2VwLkxpdGVyYWx9XG5cdCAqL1xuXHRnb2JibGVTdHJpbmdMaXRlcmFsKCkge1xuXHRcdGxldCBzdHIgPSAnJztcblx0XHRjb25zdCBzdGFydEluZGV4ID0gdGhpcy5pbmRleDtcblx0XHRjb25zdCBxdW90ZSA9IHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCsrKTtcblx0XHRsZXQgY2xvc2VkID0gZmFsc2U7XG5cblx0XHR3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMuZXhwci5sZW5ndGgpIHtcblx0XHRcdGxldCBjaCA9IHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCsrKTtcblxuXHRcdFx0aWYgKGNoID09PSBxdW90ZSkge1xuXHRcdFx0XHRjbG9zZWQgPSB0cnVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNoID09PSAnXFxcXCcpIHtcblx0XHRcdFx0Ly8gQ2hlY2sgZm9yIGFsbCBvZiB0aGUgY29tbW9uIGVzY2FwZSBjb2Rlc1xuXHRcdFx0XHRjaCA9IHRoaXMuZXhwci5jaGFyQXQodGhpcy5pbmRleCsrKTtcblxuXHRcdFx0XHRzd2l0Y2ggKGNoKSB7XG5cdFx0XHRcdFx0Y2FzZSAnbic6IHN0ciArPSAnXFxuJzsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAncic6IHN0ciArPSAnXFxyJzsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAndCc6IHN0ciArPSAnXFx0JzsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnYic6IHN0ciArPSAnXFxiJzsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnZic6IHN0ciArPSAnXFxmJzsgYnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAndic6IHN0ciArPSAnXFx4MEInOyBicmVhaztcblx0XHRcdFx0XHRkZWZhdWx0IDogc3RyICs9IGNoO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0c3RyICs9IGNoO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghY2xvc2VkKSB7XG5cdFx0XHR0aGlzLnRocm93RXJyb3IoJ1VuY2xvc2VkIHF1b3RlIGFmdGVyIFwiJyArIHN0ciArICdcIicpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiBKc2VwLkxJVEVSQUwsXG5cdFx0XHR2YWx1ZTogc3RyLFxuXHRcdFx0cmF3OiB0aGlzLmV4cHIuc3Vic3RyaW5nKHN0YXJ0SW5kZXgsIHRoaXMuaW5kZXgpLFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogR29iYmxlcyBvbmx5IGlkZW50aWZpZXJzXG5cdCAqIGUuZy46IGBmb29gLCBgX3ZhbHVlYCwgYCR4MWBcblx0ICogQWxzbywgdGhpcyBmdW5jdGlvbiBjaGVja3MgaWYgdGhhdCBpZGVudGlmaWVyIGlzIGEgbGl0ZXJhbDpcblx0ICogKGUuZy4gYHRydWVgLCBgZmFsc2VgLCBgbnVsbGApIG9yIGB0aGlzYFxuXHQgKiBAcmV0dXJucyB7anNlcC5JZGVudGlmaWVyfVxuXHQgKi9cblx0Z29iYmxlSWRlbnRpZmllcigpIHtcblx0XHRsZXQgY2ggPSB0aGlzLmNvZGUsIHN0YXJ0ID0gdGhpcy5pbmRleDtcblxuXHRcdGlmIChKc2VwLmlzSWRlbnRpZmllclN0YXJ0KGNoKSkge1xuXHRcdFx0dGhpcy5pbmRleCsrO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMudGhyb3dFcnJvcignVW5leHBlY3RlZCAnICsgdGhpcy5jaGFyKTtcblx0XHR9XG5cblx0XHR3aGlsZSAodGhpcy5pbmRleCA8IHRoaXMuZXhwci5sZW5ndGgpIHtcblx0XHRcdGNoID0gdGhpcy5jb2RlO1xuXG5cdFx0XHRpZiAoSnNlcC5pc0lkZW50aWZpZXJQYXJ0KGNoKSkge1xuXHRcdFx0XHR0aGlzLmluZGV4Kys7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiBKc2VwLklERU5USUZJRVIsXG5cdFx0XHRuYW1lOiB0aGlzLmV4cHIuc2xpY2Uoc3RhcnQsIHRoaXMuaW5kZXgpLFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogR29iYmxlcyBhIGxpc3Qgb2YgYXJndW1lbnRzIHdpdGhpbiB0aGUgY29udGV4dCBvZiBhIGZ1bmN0aW9uIGNhbGxcblx0ICogb3IgYXJyYXkgbGl0ZXJhbC4gVGhpcyBmdW5jdGlvbiBhbHNvIGFzc3VtZXMgdGhhdCB0aGUgb3BlbmluZyBjaGFyYWN0ZXJcblx0ICogYChgIG9yIGBbYCBoYXMgYWxyZWFkeSBiZWVuIGdvYmJsZWQsIGFuZCBnb2JibGVzIGV4cHJlc3Npb25zIGFuZCBjb21tYXNcblx0ICogdW50aWwgdGhlIHRlcm1pbmF0b3IgY2hhcmFjdGVyIGApYCBvciBgXWAgaXMgZW5jb3VudGVyZWQuXG5cdCAqIGUuZy4gYGZvbyhiYXIsIGJheilgLCBgbXlfZnVuYygpYCwgb3IgYFtiYXIsIGJhel1gXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSB0ZXJtaW5hdGlvblxuXHQgKiBAcmV0dXJucyB7anNlcC5FeHByZXNzaW9uW119XG5cdCAqL1xuXHRnb2JibGVBcmd1bWVudHModGVybWluYXRpb24pIHtcblx0XHRjb25zdCBhcmdzID0gW107XG5cdFx0bGV0IGNsb3NlZCA9IGZhbHNlO1xuXHRcdGxldCBzZXBhcmF0b3JfY291bnQgPSAwO1xuXG5cdFx0d2hpbGUgKHRoaXMuaW5kZXggPCB0aGlzLmV4cHIubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmdvYmJsZVNwYWNlcygpO1xuXHRcdFx0bGV0IGNoX2kgPSB0aGlzLmNvZGU7XG5cblx0XHRcdGlmIChjaF9pID09PSB0ZXJtaW5hdGlvbikgeyAvLyBkb25lIHBhcnNpbmdcblx0XHRcdFx0Y2xvc2VkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5pbmRleCsrO1xuXG5cdFx0XHRcdGlmICh0ZXJtaW5hdGlvbiA9PT0gSnNlcC5DUEFSRU5fQ09ERSAmJiBzZXBhcmF0b3JfY291bnQgJiYgc2VwYXJhdG9yX2NvdW50ID49IGFyZ3MubGVuZ3RoKXtcblx0XHRcdFx0XHR0aGlzLnRocm93RXJyb3IoJ1VuZXhwZWN0ZWQgdG9rZW4gJyArIFN0cmluZy5mcm9tQ2hhckNvZGUodGVybWluYXRpb24pKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2hfaSA9PT0gSnNlcC5DT01NQV9DT0RFKSB7IC8vIGJldHdlZW4gZXhwcmVzc2lvbnNcblx0XHRcdFx0dGhpcy5pbmRleCsrO1xuXHRcdFx0XHRzZXBhcmF0b3JfY291bnQrKztcblxuXHRcdFx0XHRpZiAoc2VwYXJhdG9yX2NvdW50ICE9PSBhcmdzLmxlbmd0aCkgeyAvLyBtaXNzaW5nIGFyZ3VtZW50XG5cdFx0XHRcdFx0aWYgKHRlcm1pbmF0aW9uID09PSBKc2VwLkNQQVJFTl9DT0RFKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRocm93RXJyb3IoJ1VuZXhwZWN0ZWQgdG9rZW4gLCcpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmICh0ZXJtaW5hdGlvbiA9PT0gSnNlcC5DQlJBQ0tfQ09ERSkge1xuXHRcdFx0XHRcdFx0Zm9yIChsZXQgYXJnID0gYXJncy5sZW5ndGg7IGFyZyA8IHNlcGFyYXRvcl9jb3VudDsgYXJnKyspIHtcblx0XHRcdFx0XHRcdFx0YXJncy5wdXNoKG51bGwpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoYXJncy5sZW5ndGggIT09IHNlcGFyYXRvcl9jb3VudCAmJiBzZXBhcmF0b3JfY291bnQgIT09IDApIHtcblx0XHRcdFx0Ly8gTk9URTogYCYmIHNlcGFyYXRvcl9jb3VudCAhPT0gMGAgYWxsb3dzIGZvciBlaXRoZXIgYWxsIGNvbW1hcywgb3IgYWxsIHNwYWNlcyBhcyBhcmd1bWVudHNcblx0XHRcdFx0dGhpcy50aHJvd0Vycm9yKCdFeHBlY3RlZCBjb21tYScpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG5vZGUgPSB0aGlzLmdvYmJsZUV4cHJlc3Npb24oKTtcblxuXHRcdFx0XHRpZiAoIW5vZGUgfHwgbm9kZS50eXBlID09PSBKc2VwLkNPTVBPVU5EKSB7XG5cdFx0XHRcdFx0dGhpcy50aHJvd0Vycm9yKCdFeHBlY3RlZCBjb21tYScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXJncy5wdXNoKG5vZGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghY2xvc2VkKSB7XG5cdFx0XHR0aGlzLnRocm93RXJyb3IoJ0V4cGVjdGVkICcgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKHRlcm1pbmF0aW9uKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyZ3M7XG5cdH1cblxuXHQvKipcblx0ICogUmVzcG9uc2libGUgZm9yIHBhcnNpbmcgYSBncm91cCBvZiB0aGluZ3Mgd2l0aGluIHBhcmVudGhlc2VzIGAoKWBcblx0ICogdGhhdCBoYXZlIG5vIGlkZW50aWZpZXIgaW4gZnJvbnQgKHNvIG5vdCBhIGZ1bmN0aW9uIGNhbGwpXG5cdCAqIFRoaXMgZnVuY3Rpb24gYXNzdW1lcyB0aGF0IGl0IG5lZWRzIHRvIGdvYmJsZSB0aGUgb3BlbmluZyBwYXJlbnRoZXNpc1xuXHQgKiBhbmQgdGhlbiB0cmllcyB0byBnb2JibGUgZXZlcnl0aGluZyB3aXRoaW4gdGhhdCBwYXJlbnRoZXNpcywgYXNzdW1pbmdcblx0ICogdGhhdCB0aGUgbmV4dCB0aGluZyBpdCBzaG91bGQgc2VlIGlzIHRoZSBjbG9zZSBwYXJlbnRoZXNpcy4gSWYgbm90LFxuXHQgKiB0aGVuIHRoZSBleHByZXNzaW9uIHByb2JhYmx5IGRvZXNuJ3QgaGF2ZSBhIGApYFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbnxqc2VwLkV4cHJlc3Npb259XG5cdCAqL1xuXHRnb2JibGVHcm91cCgpIHtcblx0XHR0aGlzLmluZGV4Kys7XG5cdFx0bGV0IG5vZGVzID0gdGhpcy5nb2JibGVFeHByZXNzaW9ucyhKc2VwLkNQQVJFTl9DT0RFKTtcblx0XHRpZiAodGhpcy5jb2RlID09PSBKc2VwLkNQQVJFTl9DT0RFKSB7XG5cdFx0XHR0aGlzLmluZGV4Kys7XG5cdFx0XHRpZiAobm9kZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHJldHVybiBub2Rlc1swXTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKCFub2Rlcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogSnNlcC5TRVFVRU5DRV9FWFAsXG5cdFx0XHRcdFx0ZXhwcmVzc2lvbnM6IG5vZGVzLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMudGhyb3dFcnJvcignVW5jbG9zZWQgKCcpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNwb25zaWJsZSBmb3IgcGFyc2luZyBBcnJheSBsaXRlcmFscyBgWzEsIDIsIDNdYFxuXHQgKiBUaGlzIGZ1bmN0aW9uIGFzc3VtZXMgdGhhdCBpdCBuZWVkcyB0byBnb2JibGUgdGhlIG9wZW5pbmcgYnJhY2tldFxuXHQgKiBhbmQgdGhlbiB0cmllcyB0byBnb2JibGUgdGhlIGV4cHJlc3Npb25zIGFzIGFyZ3VtZW50cy5cblx0ICogQHJldHVybnMge2pzZXAuQXJyYXlFeHByZXNzaW9ufVxuXHQgKi9cblx0Z29iYmxlQXJyYXkoKSB7XG5cdFx0dGhpcy5pbmRleCsrO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IEpzZXAuQVJSQVlfRVhQLFxuXHRcdFx0ZWxlbWVudHM6IHRoaXMuZ29iYmxlQXJndW1lbnRzKEpzZXAuQ0JSQUNLX0NPREUpXG5cdFx0fTtcblx0fVxufVxuXG4vLyBTdGF0aWMgZmllbGRzOlxuY29uc3QgaG9va3MgPSBuZXcgSG9va3MoKTtcbk9iamVjdC5hc3NpZ24oSnNlcCwge1xuXHRob29rcyxcblx0cGx1Z2luczogbmV3IFBsdWdpbnMoSnNlcCksXG5cblx0Ly8gTm9kZSBUeXBlc1xuXHQvLyAtLS0tLS0tLS0tXG5cdC8vIFRoaXMgaXMgdGhlIGZ1bGwgc2V0IG9mIHR5cGVzIHRoYXQgYW55IEpTRVAgbm9kZSBjYW4gYmUuXG5cdC8vIFN0b3JlIHRoZW0gaGVyZSB0byBzYXZlIHNwYWNlIHdoZW4gbWluaWZpZWRcblx0Q09NUE9VTkQ6ICAgICAgICAnQ29tcG91bmQnLFxuXHRTRVFVRU5DRV9FWFA6ICAgICdTZXF1ZW5jZUV4cHJlc3Npb24nLFxuXHRJREVOVElGSUVSOiAgICAgICdJZGVudGlmaWVyJyxcblx0TUVNQkVSX0VYUDogICAgICAnTWVtYmVyRXhwcmVzc2lvbicsXG5cdExJVEVSQUw6ICAgICAgICAgJ0xpdGVyYWwnLFxuXHRUSElTX0VYUDogICAgICAgICdUaGlzRXhwcmVzc2lvbicsXG5cdENBTExfRVhQOiAgICAgICAgJ0NhbGxFeHByZXNzaW9uJyxcblx0VU5BUllfRVhQOiAgICAgICAnVW5hcnlFeHByZXNzaW9uJyxcblx0QklOQVJZX0VYUDogICAgICAnQmluYXJ5RXhwcmVzc2lvbicsXG5cdEFSUkFZX0VYUDogICAgICAgJ0FycmF5RXhwcmVzc2lvbicsXG5cblx0VEFCX0NPREU6ICAgIDksXG5cdExGX0NPREU6ICAgICAxMCxcblx0Q1JfQ09ERTogICAgIDEzLFxuXHRTUEFDRV9DT0RFOiAgMzIsXG5cdFBFUklPRF9DT0RFOiA0NiwgLy8gJy4nXG5cdENPTU1BX0NPREU6ICA0NCwgLy8gJywnXG5cdFNRVU9URV9DT0RFOiAzOSwgLy8gc2luZ2xlIHF1b3RlXG5cdERRVU9URV9DT0RFOiAzNCwgLy8gZG91YmxlIHF1b3Rlc1xuXHRPUEFSRU5fQ09ERTogNDAsIC8vIChcblx0Q1BBUkVOX0NPREU6IDQxLCAvLyApXG5cdE9CUkFDS19DT0RFOiA5MSwgLy8gW1xuXHRDQlJBQ0tfQ09ERTogOTMsIC8vIF1cblx0UVVNQVJLX0NPREU6IDYzLCAvLyA/XG5cdFNFTUNPTF9DT0RFOiA1OSwgLy8gO1xuXHRDT0xPTl9DT0RFOiAgNTgsIC8vIDpcblxuXG5cdC8vIE9wZXJhdGlvbnNcblx0Ly8gLS0tLS0tLS0tLVxuXHQvLyBVc2UgYSBxdWlja2x5LWFjY2Vzc2libGUgbWFwIHRvIHN0b3JlIGFsbCBvZiB0aGUgdW5hcnkgb3BlcmF0b3JzXG5cdC8vIFZhbHVlcyBhcmUgc2V0IHRvIGAxYCAoaXQgcmVhbGx5IGRvZXNuJ3QgbWF0dGVyKVxuXHR1bmFyeV9vcHM6IHtcblx0XHQnLSc6IDEsXG5cdFx0JyEnOiAxLFxuXHRcdCd+JzogMSxcblx0XHQnKyc6IDFcblx0fSxcblxuXHQvLyBBbHNvIHVzZSBhIG1hcCBmb3IgdGhlIGJpbmFyeSBvcGVyYXRpb25zIGJ1dCBzZXQgdGhlaXIgdmFsdWVzIHRvIHRoZWlyXG5cdC8vIGJpbmFyeSBwcmVjZWRlbmNlIGZvciBxdWljayByZWZlcmVuY2UgKGhpZ2hlciBudW1iZXIgPSBoaWdoZXIgcHJlY2VkZW5jZSlcblx0Ly8gc2VlIFtPcmRlciBvZiBvcGVyYXRpb25zXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9PcGVyYXRvcnMvT3BlcmF0b3JfUHJlY2VkZW5jZSlcblx0YmluYXJ5X29wczoge1xuXHRcdCd8fCc6IDEsICcmJic6IDIsICd8JzogMywgJ14nOiA0LCAnJic6IDUsXG5cdFx0Jz09JzogNiwgJyE9JzogNiwgJz09PSc6IDYsICchPT0nOiA2LFxuXHRcdCc8JzogNywgJz4nOiA3LCAnPD0nOiA3LCAnPj0nOiA3LFxuXHRcdCc8PCc6IDgsICc+Pic6IDgsICc+Pj4nOiA4LFxuXHRcdCcrJzogOSwgJy0nOiA5LFxuXHRcdCcqJzogMTAsICcvJzogMTAsICclJzogMTBcblx0fSxcblxuXHQvLyBzZXRzIHNwZWNpZmljIGJpbmFyeV9vcHMgYXMgcmlnaHQtYXNzb2NpYXRpdmVcblx0cmlnaHRfYXNzb2NpYXRpdmU6IG5ldyBTZXQoKSxcblxuXHQvLyBBZGRpdGlvbmFsIHZhbGlkIGlkZW50aWZpZXIgY2hhcnMsIGFwYXJ0IGZyb20gYS16LCBBLVogYW5kIDAtOSAoZXhjZXB0IG9uIHRoZSBzdGFydGluZyBjaGFyKVxuXHRhZGRpdGlvbmFsX2lkZW50aWZpZXJfY2hhcnM6IG5ldyBTZXQoWyckJywgJ18nXSksXG5cblx0Ly8gTGl0ZXJhbHNcblx0Ly8gLS0tLS0tLS0tLVxuXHQvLyBTdG9yZSB0aGUgdmFsdWVzIHRvIHJldHVybiBmb3IgdGhlIHZhcmlvdXMgbGl0ZXJhbHMgd2UgbWF5IGVuY291bnRlclxuXHRsaXRlcmFsczoge1xuXHRcdCd0cnVlJzogdHJ1ZSxcblx0XHQnZmFsc2UnOiBmYWxzZSxcblx0XHQnbnVsbCc6IG51bGxcblx0fSxcblxuXHQvLyBFeGNlcHQgZm9yIGB0aGlzYCwgd2hpY2ggaXMgc3BlY2lhbC4gVGhpcyBjb3VsZCBiZSBjaGFuZ2VkIHRvIHNvbWV0aGluZyBsaWtlIGAnc2VsZidgIGFzIHdlbGxcblx0dGhpc19zdHI6ICd0aGlzJyxcbn0pO1xuSnNlcC5tYXhfdW5vcF9sZW4gPSBKc2VwLmdldE1heEtleUxlbihKc2VwLnVuYXJ5X29wcyk7XG5Kc2VwLm1heF9iaW5vcF9sZW4gPSBKc2VwLmdldE1heEtleUxlbihKc2VwLmJpbmFyeV9vcHMpO1xuXG4vLyBCYWNrd2FyZCBDb21wYXRpYmlsaXR5OlxuY29uc3QganNlcCA9IGV4cHIgPT4gKG5ldyBKc2VwKGV4cHIpKS5wYXJzZSgpO1xuY29uc3Qgc3RhdGljTWV0aG9kcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKEpzZXApO1xuc3RhdGljTWV0aG9kc1xuXHQuZm9yRWFjaCgobSkgPT4ge1xuXHRcdGlmIChqc2VwW21dID09PSB1bmRlZmluZWQgJiYgbSAhPT0gJ3Byb3RvdHlwZScpIHtcblx0XHRcdGpzZXBbbV0gPSBKc2VwW21dO1xuXHRcdH1cblx0fSk7XG5qc2VwLkpzZXAgPSBKc2VwOyAvLyBhbGxvd3MgZm9yIGNvbnN0IHsgSnNlcCB9ID0gcmVxdWlyZSgnanNlcCcpO1xuXG5jb25zdCBDT05ESVRJT05BTF9FWFAgPSAnQ29uZGl0aW9uYWxFeHByZXNzaW9uJztcblxudmFyIHRlcm5hcnkgPSB7XG5cdG5hbWU6ICd0ZXJuYXJ5JyxcblxuXHRpbml0KGpzZXApIHtcblx0XHQvLyBUZXJuYXJ5IGV4cHJlc3Npb246IHRlc3QgPyBjb25zZXF1ZW50IDogYWx0ZXJuYXRlXG5cdFx0anNlcC5ob29rcy5hZGQoJ2FmdGVyLWV4cHJlc3Npb24nLCBmdW5jdGlvbiBnb2JibGVUZXJuYXJ5KGVudikge1xuXHRcdFx0aWYgKGVudi5ub2RlICYmIHRoaXMuY29kZSA9PT0ganNlcC5RVU1BUktfQ09ERSkge1xuXHRcdFx0XHR0aGlzLmluZGV4Kys7XG5cdFx0XHRcdGNvbnN0IHRlc3QgPSBlbnYubm9kZTtcblx0XHRcdFx0Y29uc3QgY29uc2VxdWVudCA9IHRoaXMuZ29iYmxlRXhwcmVzc2lvbigpO1xuXG5cdFx0XHRcdGlmICghY29uc2VxdWVudCkge1xuXHRcdFx0XHRcdHRoaXMudGhyb3dFcnJvcignRXhwZWN0ZWQgZXhwcmVzc2lvbicpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5nb2JibGVTcGFjZXMoKTtcblxuXHRcdFx0XHRpZiAodGhpcy5jb2RlID09PSBqc2VwLkNPTE9OX0NPREUpIHtcblx0XHRcdFx0XHR0aGlzLmluZGV4Kys7XG5cdFx0XHRcdFx0Y29uc3QgYWx0ZXJuYXRlID0gdGhpcy5nb2JibGVFeHByZXNzaW9uKCk7XG5cblx0XHRcdFx0XHRpZiAoIWFsdGVybmF0ZSkge1xuXHRcdFx0XHRcdFx0dGhpcy50aHJvd0Vycm9yKCdFeHBlY3RlZCBleHByZXNzaW9uJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVudi5ub2RlID0ge1xuXHRcdFx0XHRcdFx0dHlwZTogQ09ORElUSU9OQUxfRVhQLFxuXHRcdFx0XHRcdFx0dGVzdCxcblx0XHRcdFx0XHRcdGNvbnNlcXVlbnQsXG5cdFx0XHRcdFx0XHRhbHRlcm5hdGUsXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdC8vIGNoZWNrIGZvciBvcGVyYXRvcnMgb2YgaGlnaGVyIHByaW9yaXR5IHRoYW4gdGVybmFyeSAoaS5lLiBhc3NpZ25tZW50KVxuXHRcdFx0XHRcdC8vIGpzZXAgc2V0cyB8fCBhdCAxLCBhbmQgYXNzaWdubWVudCBhdCAwLjksIGFuZCBjb25kaXRpb25hbCBzaG91bGQgYmUgYmV0d2VlbiB0aGVtXG5cdFx0XHRcdFx0aWYgKHRlc3Qub3BlcmF0b3IgJiYganNlcC5iaW5hcnlfb3BzW3Rlc3Qub3BlcmF0b3JdIDw9IDAuOSkge1xuXHRcdFx0XHRcdFx0bGV0IG5ld1Rlc3QgPSB0ZXN0O1xuXHRcdFx0XHRcdFx0d2hpbGUgKG5ld1Rlc3QucmlnaHQub3BlcmF0b3IgJiYganNlcC5iaW5hcnlfb3BzW25ld1Rlc3QucmlnaHQub3BlcmF0b3JdIDw9IDAuOSkge1xuXHRcdFx0XHRcdFx0XHRuZXdUZXN0ID0gbmV3VGVzdC5yaWdodDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVudi5ub2RlLnRlc3QgPSBuZXdUZXN0LnJpZ2h0O1xuXHRcdFx0XHRcdFx0bmV3VGVzdC5yaWdodCA9IGVudi5ub2RlO1xuXHRcdFx0XHRcdFx0ZW52Lm5vZGUgPSB0ZXN0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnRocm93RXJyb3IoJ0V4cGVjdGVkIDonKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9LFxufTtcblxuLy8gQWRkIGRlZmF1bHQgcGx1Z2luczpcblxuanNlcC5wbHVnaW5zLnJlZ2lzdGVyKHRlcm5hcnkpO1xuXG5leHBvcnQgeyBKc2VwLCBqc2VwIGFzIGRlZmF1bHQgfTtcbiIsIi8qKlxuICogTUlUIExpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOCBTZW5zYXRpdmUgQUJcblxuUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxub2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxuaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xudG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG5mdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuXG5UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbklNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG5BVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG5MSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuVEhFIFNPRlRXQVJFLlxuICovXG4vL1xuLy8gZXZhbHVhdGVzIGphdmFzY3JpcHQgZXhwcmVzc2lvbiBzdGF0ZW1lbnRzIHBhcnNlZCB3aXRoIGpzZXBcbi8vXG5cbmltcG9ydCBKc2VwIGZyb20gJ2pzZXAnO1xuXG5cbmNvbnN0IG9wZXJhdG9ycyA9IHtcbiAgYmluYXJ5OiB7XG4gICAgJz09PSc6IChhLCBiKSA9PiAoYSA9PT0gYiksXG4gICAgJyE9PSc6IChhLCBiKSA9PiAoYSAhPT0gYiksXG4gICAgJz09JzogKGEsIGIpID0+IChhID09IGIpLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgJyE9JzogKGEsIGIpID0+IChhICE9IGIpLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgJz4nOiAoYSwgYikgPT4gKGEgPiBiKSxcbiAgICAnPCc6IChhLCBiKSA9PiAoYSA8IGIpLFxuICAgICc+PSc6IChhLCBiKSA9PiAoYSA+PSBiKSxcbiAgICAnPD0nOiAoYSwgYikgPT4gKGEgPD0gYiksXG4gICAgJysnOiAoYSwgYikgPT4gKGEgKyBiKSxcbiAgICAnLSc6IChhLCBiKSA9PiAoYSAtIGIpLFxuICAgICcqJzogKGEsIGIpID0+IChhICogYiksXG4gICAgJy8nOiAoYSwgYikgPT4gKGEgLyBiKSxcbiAgICAnJSc6IChhLCBiKSA9PiAoYSAlIGIpLCAvLyByZW1haW5kZXJcbiAgICAnKionOiAoYSwgYikgPT4gKGEgKiogYiksIC8vIGV4cG9uZW50aWF0aW9uXG4gICAgJyYnOiAoYSwgYikgPT4gKGEgJiBiKSwgLy8gYml0d2lzZSBBTkRcbiAgICAnfCc6IChhLCBiKSA9PiAoYSB8IGIpLCAvLyBiaXR3aXNlIE9SXG4gICAgJ14nOiAoYSwgYikgPT4gKGEgXiBiKSwgLy8gYml0d2lzZSBYT1JcbiAgICAnPDwnOiAoYSwgYikgPT4gKGEgPDwgYiksIC8vIGxlZnQgc2hpZnRcbiAgICAnPj4nOiAoYSwgYikgPT4gKGEgPj4gYiksIC8vIHNpZ24tcHJvcGFnYXRpbmcgcmlnaHQgc2hpZnRcbiAgICAnPj4+JzogKGEsIGIpID0+IChhID4+PiBiKSwgLy8gemVyby1maWxsIHJpZ2h0IHNoaWZ0XG4gICAgLy8gTGV0J3MgbWFrZSBhIGhvbWUgZm9yIHRoZSBsb2dpY2FsIG9wZXJhdG9ycyBoZXJlIGFzIHdlbGxcbiAgICAnfHwnOiAoYSwgYikgPT4gKGEgfHwgYiksXG4gICAgJyYmJzogKGEsIGIpID0+IChhICYmIGIpLFxuICB9LFxuICB1bmFyeToge1xuICAgICchJzogYSA9PiAhYSxcbiAgICAnfic6IGEgPT4gfmEsIC8vIGJpdHdpc2UgTk9UXG4gICAgJysnOiBhID0+ICthLCAvLyB1bmFyeSBwbHVzXG4gICAgJy0nOiBhID0+IC1hLCAvLyB1bmFyeSBuZWdhdGlvblxuICAgICcrKyc6IGEgPT4gKythLCAvLyBpbmNyZW1lbnRcbiAgICAnLS0nOiBhID0+IC0tYSwgLy8gZGVjcmVtZW50XG4gIH0sXG59O1xuXG5jb25zdCB0eXBlcyA9IHtcbiAgLy8gc3VwcG9ydGVkXG4gIExJVEVSQUw6ICdMaXRlcmFsJyxcbiAgVU5BUlk6ICdVbmFyeUV4cHJlc3Npb24nLFxuICBCSU5BUlk6ICdCaW5hcnlFeHByZXNzaW9uJyxcbiAgTE9HSUNBTDogJ0xvZ2ljYWxFeHByZXNzaW9uJyxcbiAgQ09ORElUSU9OQUw6ICdDb25kaXRpb25hbEV4cHJlc3Npb24nLCAgLy8gYSA/IGIgOiBjXG4gIE1FTUJFUjogJ01lbWJlckV4cHJlc3Npb24nLFxuICBJREVOVElGSUVSOiAnSWRlbnRpZmllcicsXG4gIFRISVM6ICdUaGlzRXhwcmVzc2lvbicsIC8vIGUuZy4gJ3RoaXMud2lsbEJlVXNlZCdcbiAgQ0FMTDogJ0NhbGxFeHByZXNzaW9uJywgLy8gZS5nLiB3aGF0Y2hhKGRvaW5nKVxuICBBUlJBWTogJ0FycmF5RXhwcmVzc2lvbicsIC8vIGUuZy4gW2EsIDIsIGcoaCksICdldGMnXVxuICBDT01QT1VORDogJ0NvbXBvdW5kJyAvLyAnYT09PTIsIGI9PT0zJyA8LS0gbXVsdGlwbGUgY29tbWEgc2VwYXJhdGVkIGV4cHJlc3Npb25zLi4gcmV0dXJucyBsYXN0XG59O1xuY29uc3QgdW5kZWZPcGVyYXRvciA9ICgpID0+IHVuZGVmaW5lZDtcblxuY29uc3QgZ2V0UGFyYW1ldGVyUGF0aCA9IChub2RlLCBjb250ZXh0KSA9PiB7XG4gIGFzc2VydChub2RlLCAnTm9kZSBtaXNzaW5nJyk7XG4gIGNvbnN0IHR5cGUgPSBub2RlLnR5cGU7XG4gIGFzc2VydChPYmplY3QudmFsdWVzKHR5cGVzKS5pbmNsdWRlcyh0eXBlKSwgJ2ludmFsaWQgdHlwZSAnK3R5cGUpO1xuICBhc3NlcnQoW3R5cGVzLk1FTUJFUiwgdHlwZXMuSURFTlRJRklFUl0uaW5jbHVkZXModHlwZSksICdJbnZhbGlkIHBhcmFtZXRlciBwYXRoIG5vZGUgdHlwZTogJyt0eXBlKTtcbiAgLy8gdGhlIGVhc3kgY2FzZTogJ0lERU5USUZJRVInc1xuICBpZiAodHlwZSA9PT0gdHlwZXMuSURFTlRJRklFUikge1xuICAgIHJldHVybiBub2RlLm5hbWU7XG4gIH1cbiAgLy8gT3RoZXJ3aXNlIGl0J3MgYSBNRU1CRVIgZXhwcmVzc2lvblxuICAvLyBFWEFNUExFUzogIGFbYl0gKGNvbXB1dGVkKVxuICAvLyAgICAgICAgICAgIGEuYiAobm90IGNvbXB1dGVkKVxuICBjb25zdCBjb21wdXRlZCA9IG5vZGUuY29tcHV0ZWQ7XG4gIGNvbnN0IG9iamVjdCA9IG5vZGUub2JqZWN0O1xuICBjb25zdCBwcm9wZXJ0eSA9IG5vZGUucHJvcGVydHk7XG4gIC8vIG9iamVjdCBpcyBlaXRoZXIgJ0lERU5USUZJRVInLCAnTUVNQkVSJywgb3IgJ1RISVMnXG4gIGFzc2VydChbdHlwZXMuTUVNQkVSLCB0eXBlcy5JREVOVElGSUVSLCB0eXBlcy5USElTXS5pbmNsdWRlcyhvYmplY3QudHlwZSksICdJbnZhbGlkIG9iamVjdCB0eXBlJyk7XG4gIGFzc2VydChwcm9wZXJ0eSwgJ01lbWJlciBleHByZXNzaW9uIHByb3BlcnR5IGlzIG1pc3NpbmcnKTtcblxuICBsZXQgb2JqZWN0UGF0aCA9ICcnO1xuICBpZiAob2JqZWN0LnR5cGUgPT09IHR5cGVzLlRISVMpIHtcbiAgICBvYmplY3RQYXRoID0gJyc7XG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0UGF0aCA9IG5vZGUubmFtZSB8fCBnZXRQYXJhbWV0ZXJQYXRoKG9iamVjdCwgY29udGV4dCk7XG4gIH1cblxuICBpZiAoY29tcHV0ZWQpIHtcbiAgICAvLyBpZiBjb21wdXRlZCAtPiBldmFsdWF0ZSBhbmV3XG4gICAgY29uc3QgcHJvcGVydHlQYXRoID0gZXZhbHVhdGVFeHByZXNzaW9uTm9kZShwcm9wZXJ0eSwgY29udGV4dCk7XG4gICAgcmV0dXJuIG9iamVjdFBhdGggKyAnWycgKyBwcm9wZXJ0eVBhdGggKyAnXSc7XG4gIH0gZWxzZSB7XG4gICAgYXNzZXJ0KFt0eXBlcy5NRU1CRVIsIHR5cGVzLklERU5USUZJRVJdLmluY2x1ZGVzKCBwcm9wZXJ0eS50eXBlKSwgJ0ludmFsaWQgb2JqZWN0IHR5cGUnKTtcbiAgICBjb25zdCBwcm9wZXJ0eVBhdGggPSBwcm9wZXJ0eS5uYW1lIHx8IGdldFBhcmFtZXRlclBhdGgocHJvcGVydHksIGNvbnRleHQpO1xuICAgIHJldHVybiAob2JqZWN0UGF0aCA/IG9iamVjdFBhdGggKyAnLic6ICcnKSArIHByb3BlcnR5UGF0aDtcbiAgfVxufTtcblxuY29uc3QgZXZhbHVhdGVFeHByZXNzaW9uTm9kZSA9IChub2RlLCBjb250ZXh0KSA9PiB7XG4gIGFzc2VydChub2RlLCAnTm9kZSBtaXNzaW5nJyk7XG4gIGFzc2VydChPYmplY3QudmFsdWVzKHR5cGVzKS5pbmNsdWRlcyhub2RlLnR5cGUpLCBcImludmFsaWQgbm9kZSB0eXBlXCIsIG5vZGUgKTtcbiAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICBjYXNlIHR5cGVzLkxJVEVSQUw6IHtcbiAgICAgIHJldHVybiBub2RlLnZhbHVlO1xuICAgIH1cbiAgICBjYXNlIHR5cGVzLlRISVM6IHtcbiAgICAgIHJldHVybiBjb250ZXh0O1xuICAgIH1cbiAgICBjYXNlIHR5cGVzLkNPTVBPVU5EOiB7XG4gICAgICBjb25zdCBleHByZXNzaW9ucyA9IG5vZGUuYm9keS5tYXAoZWwgPT4gZXZhbHVhdGVFeHByZXNzaW9uTm9kZShlbCwgY29udGV4dCkpO1xuICAgICAgcmV0dXJuIGV4cHJlc3Npb25zLnBvcCgpO1xuICAgIH1cbiAgICBjYXNlIHR5cGVzLkFSUkFZOiB7XG4gICAgICByZXR1cm4gbm9kZS5lbGVtZW50cy5tYXAoZWwgPT4gZXZhbHVhdGVFeHByZXNzaW9uTm9kZShlbCwgY29udGV4dCkpO1xuICAgIH1cbiAgICBjYXNlIHR5cGVzLlVOQVJZOiB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IG9wZXJhdG9ycy51bmFyeVtub2RlLm9wZXJhdG9yXSB8fCB1bmRlZk9wZXJhdG9yO1xuICAgICAgYXNzZXJ0KG9wZXJhdG9ycy51bmFyeVtvcGVyYXRvcl0sICdJbnZhbGlkIHVuYXJ5IG9wZXJhdG9yJyk7XG4gICAgICBjb25zdCBhcmd1bWVudCA9IGV2YWx1YXRlRXhwcmVzc2lvbk5vZGUobm9kZS5hcmd1bWVudCwgY29udGV4dCk7XG4gICAgICByZXR1cm4gb3BlcmF0b3IoYXJndW1lbnQpO1xuICAgIH1cbiAgICBjYXNlIHR5cGVzLkxPR0lDQUw6IC8vICEhISBmYWxsLXRocm91Z2ggdG8gQklOQVJZICEhISAvL1xuICAgIGNhc2UgdHlwZXMuQklOQVJZOiB7XG4gICAgICBjb25zdCBvcGVyYXRvciA9IG9wZXJhdG9ycy5iaW5hcnlbbm9kZS5vcGVyYXRvcl0gfHwgdW5kZWZPcGVyYXRvcjtcbiAgICAgIGFzc2VydChvcGVyYXRvcnMuYmluYXJ5W29wZXJhdG9yXSwgJ0ludmFsaWQgYmluYXJ5IG9wZXJhdG9yJyk7XG4gICAgICBjb25zdCBsZWZ0ID0gZXZhbHVhdGVFeHByZXNzaW9uTm9kZShub2RlLmxlZnQsIGNvbnRleHQpO1xuICAgICAgY29uc3QgcmlnaHQgPSBldmFsdWF0ZUV4cHJlc3Npb25Ob2RlKG5vZGUucmlnaHQsIGNvbnRleHQpO1xuICAgICAgcmV0dXJuIG9wZXJhdG9yKGxlZnQsIHJpZ2h0KTtcbiAgICB9XG4gICAgY2FzZSB0eXBlcy5DT05ESVRJT05BTDoge1xuICAgICAgY29uc3QgdGVzdCA9IGV2YWx1YXRlRXhwcmVzc2lvbk5vZGUobm9kZS50ZXN0LCBjb250ZXh0KTtcbiAgICAgIGNvbnN0IGNvbnNlcXVlbnQgPSBldmFsdWF0ZUV4cHJlc3Npb25Ob2RlKG5vZGUuY29uc2VxdWVudCwgY29udGV4dCk7XG4gICAgICBjb25zdCBhbHRlcm5hdGUgPSBldmFsdWF0ZUV4cHJlc3Npb25Ob2RlKG5vZGUuYWx0ZXJuYXRlLCBjb250ZXh0KTtcbiAgICAgIHJldHVybiB0ZXN0ID8gY29uc2VxdWVudCA6IGFsdGVybmF0ZTtcbiAgICB9XG4gICAgY2FzZSB0eXBlcy5DQUxMIDoge1xuICAgICAgYXNzZXJ0KFt0eXBlcy5NRU1CRVIsIHR5cGVzLklERU5USUZJRVIsIHR5cGVzLlRISVNdLmluY2x1ZGVzKG5vZGUuY2FsbGVlLnR5cGUpLCAnSW52YWxpZCBmdW5jdGlvbiBjYWxsZWUgdHlwZScpO1xuICAgICAgY29uc3QgY2FsbGVlID0gZXZhbHVhdGVFeHByZXNzaW9uTm9kZShub2RlLmNhbGxlZSwgY29udGV4dCk7XG4gICAgICBjb25zdCBhcmdzID0gbm9kZS5hcmd1bWVudHMubWFwKGFyZyA9PiBldmFsdWF0ZUV4cHJlc3Npb25Ob2RlKGFyZywgY29udGV4dCkpO1xuICAgICAgcmV0dXJuIGNhbGxlZS5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9XG4gICAgY2FzZSB0eXBlcy5JREVOVElGSUVSOiAvLyAhISEgZmFsbC10aHJvdWdoIHRvIE1FTUJFUiAhISEgLy9cbiAgICBjYXNlIHR5cGVzLk1FTUJFUjoge1xuICAgICAgY29uc3QgcGF0aCA9IGdldFBhcmFtZXRlclBhdGgobm9kZSwgY29udGV4dCk7XG4gICAgICByZXR1cm4gX2dldChjb250ZXh0LCBwYXRoKTtcbiAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn07XG5cbmNvbnN0IGV2YWx1YXRlID0gKGV4cHJlc3Npb24sIGNvbnRleHQpID0+IHtcbiAgY29uc3QgdHJlZSA9IEpzZXAoZXhwcmVzc2lvbik7XG4gIHJldHVybiBldmFsdWF0ZUV4cHJlc3Npb25Ob2RlKHRyZWUsIGNvbnRleHQpO1xufTtcblxuLy8gaXMganVzdCBhIHByb21pc2Ugd3JhcHBlclxuY29uc3QgcGV2YWwgPSAoZXhwcmVzc2lvbiwgY29udGV4dCkgPT4ge1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiBldmFsdWF0ZShleHByZXNzaW9uLCBjb250ZXh0KSk7XG59O1xuXG5leHBvcnQge1xuICBldmFsdWF0ZSxcbiAgcGV2YWwsXG4gIHR5cGVzLFxuICBvcGVyYXRvcnNcbn07XG5cbmZ1bmN0aW9uIGFzc2VydCh2YWx1ZSwgZXJyb3JNc2csIGVycm9yQXJncz8pe1xuICBpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG4gIGlmKCEhdmFsdWUpIHJldHVybjtcbiAgaWYoIXZhbHVlKXtcbiAgICBjb25zb2xlLmVycm9yKGVycm9yTXNnLCBlcnJvckFyZ3MpO1xuICAgIHRocm93IEVycm9yKGVycm9yTXNnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfZ2V0KCBvYmplY3QsIGtleXMsIGRlZmF1bHRWYWw/ICl7XG4gIGtleXMgPSBBcnJheS5pc0FycmF5KCBrZXlzICk/IGtleXMgOiBrZXlzLnNwbGl0KCcuJyk7XG4gIG9iamVjdCA9IG9iamVjdFtrZXlzWzBdXTtcbiAgaWYoIG9iamVjdCAmJiBrZXlzLmxlbmd0aD4xICl7XG4gICAgcmV0dXJuIF9nZXQoIG9iamVjdCwga2V5cy5zbGljZSgxKSApO1xuICB9XG4gIHJldHVybiBvYmplY3QgPT09IHVuZGVmaW5lZD8gZGVmYXVsdFZhbCA6IG9iamVjdDtcbn0iLCJpbXBvcnQgeyBjcmVhdGVTdGF0ZSB9IGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgSnNlcCBmcm9tIFwianNlcFwiO1xuaW1wb3J0IHsgZXZhbHVhdGUgfSBmcm9tIFwiLi9qc2VwLWV2YWxcIjtcblxuZXhwb3J0IHR5cGUgUnVudGltZUFzc2lnbm1lbnRQYXJhbXMgPSB7XG4gICAgc3RvcmFnZSxcbiAgICBleHByZXNzaW9uLFxuICAgIGxpc3Rlbj8sXG4gICAgY29uZGl0aW9uPyxcbiAgICB0aW1lb3V0P1xufTtcbmV4cG9ydCBlbnVtIEVWRU5UIHtcbiAgICBFVkVOVF9WQVJJQUJMRV9DSEFOR0Vcbn1cblxuY29uc3QgY3JlYXRlRXhwcmVzc2lvbk1hbmFnZXIgPSAoIGluaXRpYWxTdGF0ZTogYW55LCB7aW5pdGlhbEFzc2lnbm1lbnRzID0gbnVsbCwgY29udGV4dH06YW55ID0ge30pPT57XG4gICAgY29uc3QgZGVmYXVsdENvbnRleHQgPSB7XG4gICAgICAgIC4uLmNvbnRleHRcbiAgICB9O1xuXG4gICAgY29uc3Qgc3RvcmUgPSBjcmVhdGVTdGF0ZShpbml0aWFsU3RhdGUpO1xuICAgIGNvbnN0IGNhbGxiYWNrcyA9IHtcbiAgICAgICAgb25FdmVudDogW11cbiAgICB9O1xuICAgIGNvbnN0IHZhcmlhYmxlQ29udHJvbFJlYWRMaW5rc01hcCA9IHt9O1xuICAgIGNvbnN0IGFzc2lnbm1lbnREZXBlbmRlbmNpZXMgPSB7fTtcbiAgICBjb25zdCBERUZBVUxUX0FDQ19FVkVOVCA9KCk9Pih7XG4gICAgICAgIHRhcmdldENvbnRyb2xJZHM6W10sXG4gICAgICAgIG5ld1ZhbHVlczp7fSxcbiAgICAgICAgb2xkVmFsdWVzOnt9XG4gICAgfSk7XG4gICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICAgIGFjY0V2ZW50OkRFRkFVTFRfQUNDX0VWRU5UKClcbiAgICB9O1xuXG4gICAgc3RvcmUub25DaGFuZ2UoKHtuZXdWYWx1ZSwgb2xkVmFsdWUsIHByb3B9KT0+e1xuICAgICAgICBjb25zdCBkZWxheWVkQXNzaWdubWVudHMgPSBbXTtcbiAgICAgICAgYXBwbHlWYXJpYWJsZUFzc2lnbm1lbnRGcm9tVmFyaWFibGVOYW1lKHByb3ApO1xuICAgICAgICBjb25zdCB0YXJnZXRDb250cm9sSWRzID0gQXJyYXkuZnJvbShuZXcgU2V0KCBbXG4gICAgICAgICAgICAuLi4odmFyaWFibGVDb250cm9sUmVhZExpbmtzTWFwW3Byb3BdfHxbXSkubWFwKGM9PmMuaWQpLFxuICAgICAgICAgICAgLi4uZ2V0Q29udHJvbHNBZmZlY3RlZEJ5QXNzaWdubWVudFRvKHByb3ApLm1hcChjPT5jLmlkKVxuICAgICAgICBdICkpO1xuICAgICAgICBzdGF0ZS5hY2NFdmVudC50YXJnZXRDb250cm9sSWRzID0gQXJyYXkuZnJvbShuZXcgU2V0KFsuLi5zdGF0ZS5hY2NFdmVudC50YXJnZXRDb250cm9sSWRzLCAuLi50YXJnZXRDb250cm9sSWRzXSkpOy8vVE9ETyBjYW4gYmUgb3B0aW1pemVkIGlmIG5lY2Vzc2FyeVxuICAgICAgICBzdGF0ZS5hY2NFdmVudC5uZXdWYWx1ZXNbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICAgICAgc3RhdGUuYWNjRXZlbnQub2xkVmFsdWVzW3Byb3BdID0gb2xkVmFsdWU7XG4gICAgICAgIGlmKGRlbGF5ZWRBc3NpZ25tZW50cyl7XG4gICAgICAgICAgICBkZWxheWVkQXNzaWdubWVudHMuZm9yRWFjaCgoZGVsYXllZEFzc2lnbm1lbnQpPT57XG4gICAgICAgICAgICAgICAgY29uc3QgW2ZuLGFzc2lnbm1lbnRdID0gZGVsYXllZEFzc2lnbm1lbnQ7XG4gICAgICAgICAgICAgICAgY29uc3Qge3RpbWVvdXQsY29uZGl0aW9ufSA9IGFzc2lnbm1lbnQ7XG5cbiAgICAgICAgICAgICAgICAvL1RPRE8gcmV2aWV3IGlmIGl0IHdvdWxkIGJlIGJldHRlciB0byBkZWZpbmUgYSBzZXRTdGF0ZSB3cmFwcGVyIGZ1bmN0aW9uIHRoYXQgZG9lcyB0aGUgam9pbkV2ZW50IGluc2lkZVxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCk9PntcbiAgICAgICAgICAgICAgICAgICAgaWYoY29uZGl0aW9uICYmIGV2YWx1YXRlRXhwcmVzc2lvbihjb25kaXRpb24pKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvaW5FdmVudChmbiwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1lbHNlIGlmKCFjb25kaXRpb24pe1xuICAgICAgICAgICAgICAgICAgICAgICAgam9pbkV2ZW50KGZuLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSwgdGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVtb3ZlVmFsdWVGcm9tQXJyYXkoZGVsYXllZEFzc2lnbm1lbnRzLCBkZWxheWVkQXNzaWdubWVudClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYXBwbHlWYXJpYWJsZUFzc2lnbm1lbnRGcm9tVmFyaWFibGVOYW1lKGxpc3RlblZhcmlhYmxlKXtcbiAgICAgICAgICAgIGNvbnN0IGFzc2lnbm1lbnRzTWFwID0gYXNzaWdubWVudERlcGVuZGVuY2llc1tsaXN0ZW5WYXJpYWJsZV18fHt9O1xuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXNzaWdubWVudHNNYXApLmZvckVhY2goKGFzc2lnbm1lbnRTdG9yYWdlTmFtZSk9PntcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NpZ25tZW50ID0gYXNzaWdubWVudHNNYXBbYXNzaWdubWVudFN0b3JhZ2VOYW1lXTtcbiAgICAgICAgICAgICAgICBpZihhc3NpZ25tZW50LnRpbWVvdXQpe1xuICAgICAgICAgICAgICAgICAgICBkZWxheWVkQXNzaWdubWVudHMucHVzaChbYXBwbHlFdmFsdWF0aW9uLCBhc3NpZ25tZW50XSk7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5RXZhbHVhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBhcHBseUV2YWx1YXRpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgaWYoYXNzaWdubWVudC5jb25kaXRpb24pe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29uZGl0aW9uUmVzdWx0ID0gZXZhbHVhdGVFeHByZXNzaW9uKGFzc2lnbm1lbnQuY29uZGl0aW9uKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoY29uZGl0aW9uUmVzdWx0KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9yZS5zZXRTdGF0ZSh7W2Fzc2lnbm1lbnRTdG9yYWdlTmFtZV06ZXZhbHVhdGVFeHByZXNzaW9uKCBhc3NpZ25tZW50LmV4cHJlc3Npb24gKX0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmUuc2V0U3RhdGUoe1thc3NpZ25tZW50U3RvcmFnZU5hbWVdOmV2YWx1YXRlRXhwcmVzc2lvbiggYXNzaWdubWVudC5leHByZXNzaW9uICl9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmKGluaXRpYWxBc3NpZ25tZW50cyl7XG4gICAgICAgIGNvbnN0IGluaXRpYWxpemF0aW9uU3RhdGUgPSBPYmplY3Qua2V5cyhpbml0aWFsQXNzaWdubWVudHMpLnJlZHVjZSgoYWNjLCB2YXJpYWJsZU5hbWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2YWx1YXRpb24gPSBldmFsdWF0ZUV4cHJlc3Npb24oaW5pdGlhbEFzc2lnbm1lbnRzW3ZhcmlhYmxlTmFtZV0pO1xuICAgICAgICAgICAgYWNjW3ZhcmlhYmxlTmFtZV0gPSBldmFsdWF0aW9uO1xuICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgfSwge30pO1xuICAgICAgICBzdG9yZS5zZXRTdGF0ZShpbml0aWFsaXphdGlvblN0YXRlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRDb250cm9sc0FmZmVjdGVkQnlBc3NpZ25tZW50VG8oY2hhbmdlZFZhcmlhYmxlTmFtZSl7Ly9UT0RPIG9wdGltaXplP1xuICAgICAgICBjb25zdCBjaGFuZ2VkU3RvcmFnZXMgPSBPYmplY3Qua2V5cyhhc3NpZ25tZW50RGVwZW5kZW5jaWVzW2NoYW5nZWRWYXJpYWJsZU5hbWVdfHx7fSk7XG5cbiAgICAgICAgcmV0dXJuIGNoYW5nZWRTdG9yYWdlcy5mbGF0KCkubWFwKHN0b3JhZ2U9PnZhcmlhYmxlQ29udHJvbFJlYWRMaW5rc01hcFtzdG9yYWdlXSkuZmxhdCgpLmZpbHRlcihpPT5pKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBqb2luRXZlbnQoZm4sIGlzRGVsYXllZD8pe1xuICAgICAgICBzdGF0ZS5hY2NFdmVudCA9IERFRkFVTFRfQUNDX0VWRU5UKCk7XG4gICAgICAgIGZuKCk7XG4gICAgICAgIGNhbGxiYWNrcy5vbkV2ZW50LmZvckVhY2goZm49PntcbiAgICAgICAgICAgIGZuKHtcbiAgICAgICAgICAgICAgICB0eXBlOkVWRU5ULkVWRU5UX1ZBUklBQkxFX0NIQU5HRSxcbiAgICAgICAgICAgICAgICBkYXRhOntcbiAgICAgICAgICAgICAgICAgICAgLi4uc3RhdGUuYWNjRXZlbnQsXG4gICAgICAgICAgICAgICAgICAgIGlzRGVsYXllZDohIWlzRGVsYXllZCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgIH1cblxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWRkQ29udHJvbDogKCh7aWQsIHJ1bnRpbWUsIGRlZmF1bHRWYWx1ZX06e2lkOmFueSwgcnVudGltZTphbnksIGRlZmF1bHRWYWx1ZT86YW55fSk9PntcbiAgICAgICAgICAgIGNvbnN0IHN0b3JhZ2UgPSBydW50aW1lLnN0b3JhZ2U7XG4gICAgICAgICAgICBjb25zdCBleHByZXNzaW9uc1RvTGlzdGVuOnN0cmluZ1tdID0gT2JqZWN0LnZhbHVlcyhydW50aW1lKS5maWx0ZXIoaT0+aSkgYXMgc3RyaW5nW107XG4gICAgICAgICAgICBjb25zdCB2YXJpYWJsZU5hbWVzID0gZXhwcmVzc2lvbnNUb0xpc3Rlbi5tYXAoZT0+IGdldFZhcmlhYmxlc0Zyb21Ob2RlKFtdLCBKc2VwKGUpKSkuZmxhdCgpO1xuICAgICAgICAgICAgY29uc3QgY29udHJvbCA9IHtcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBydW50aW1lLFxuICAgICAgICAgICAgICAgIHNldFZhbHVlOnN0b3JhZ2UgJiYgKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBqb2luRXZlbnQoKCk9PnN0b3JlLnNldFN0YXRlKHtbc3RvcmFnZV06dmFsdWV9KSk7XG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgZXZhbHVhdGU6KHByb3ApPT57XG4gICAgICAgICAgICAgICAgICAgIGlmKCFwcm9wKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdG9yYWdlICYmIHN0b3JlLmdldFN0YXRlKClbc3RvcmFnZV0vLzpldmFsdWF0ZUV4cHJlc3Npb24ocmVhZClcbiAgICAgICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXZhbHVhdGVFeHByZXNzaW9uKHJ1bnRpbWVbcHJvcF0sIHN0b3JlLmdldFN0YXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhcmlhYmxlTmFtZXMuZm9yRWFjaCgodmFyaWFibGVOYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyaWFibGVDb250cm9sUmVhZExpbmtzTWFwW3ZhcmlhYmxlTmFtZV0gPSB2YXJpYWJsZUNvbnRyb2xSZWFkTGlua3NNYXBbdmFyaWFibGVOYW1lXSB8fCBbXTtcbiAgICAgICAgICAgICAgICBpZih2YXJpYWJsZUNvbnRyb2xSZWFkTGlua3NNYXBbdmFyaWFibGVOYW1lXS5pbmRleE9mKGNvbnRyb2wpID09PSAtMSl7XG4gICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlQ29udHJvbFJlYWRMaW5rc01hcFt2YXJpYWJsZU5hbWVdLnB1c2goY29udHJvbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gY29udHJvbDtcblxuICAgICAgICB9KSxcbiAgICAgICAgYWRkUnVudGltZUFzc2lnbm1lbnQ6ICh7c3RvcmFnZSwgZXhwcmVzc2lvbiwgbGlzdGVuLCB0aW1lb3V0LGNvbmRpdGlvbn06UnVudGltZUFzc2lnbm1lbnRQYXJhbXMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZXNUb0xpc3RlbiA9IGxpc3RlbiA/IFsuLi5saXN0ZW4uc3BsaXQoXCIsXCIpLm1hcChsPT5sLnRyaW0oKSldIDogKGdldFZhcmlhYmxlc0Zyb21Ob2RlKFtdLCBKc2VwKGV4cHJlc3Npb24pKXx8W10pO1xuICAgICAgICAgICAgdmFyaWFibGVOYW1lc1RvTGlzdGVuLmZvckVhY2goKGxpc3RlblZhcmlhYmxlKT0+e1xuICAgICAgICAgICAgICAgIGFzc2lnbm1lbnREZXBlbmRlbmNpZXNbbGlzdGVuVmFyaWFibGVdID0gYXNzaWdubWVudERlcGVuZGVuY2llc1tsaXN0ZW5WYXJpYWJsZV0gfHwge307XG4gICAgICAgICAgICAgICAgYXNzaWdubWVudERlcGVuZGVuY2llc1tsaXN0ZW5WYXJpYWJsZV1bc3RvcmFnZV0gPSB7c3RvcmFnZSwgZXhwcmVzc2lvbiwgbGlzdGVuLCB0aW1lb3V0LCBjb25kaXRpb259O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFN0YXRlOiAodmFsdWUpID0+IGpvaW5FdmVudCgoKT0+c3RvcmUuc2V0U3RhdGUodmFsdWUpKSxcbiAgICAgICAgZ2V0U3RhdGU6ICgpID0+IHN0b3JlLmdldFN0YXRlKCksXG4gICAgICAgIG9uRXZlbnQ6IChmbikgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uRXZlbnQucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gY2FsbGJhY2tzLm9uRXZlbnQuc3BsaWNlKCBjYWxsYmFja3Mub25FdmVudC5pbmRleE9mKGZuKSAsMSk7XG4gICAgICAgIH0sXG4gICAgICAgIGRpc3Bvc2U6ICgpID0+IHtcbiAgICAgICAgICAgIC8vVE9ET1xuICAgICAgICB9LFxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBldmFsdWF0ZUV4cHJlc3Npb24oZXhwcmVzc2lvbiwgY29udGV4dCA9IHN0b3JlLmdldFN0YXRlKCkpe1xuICAgICAgICBjb25zdCByZXN1bHQgPWV2YWx1YXRlKGV4cHJlc3Npb24sIHsuLi5kZWZhdWx0Q29udGV4dCwgLi4uY29udGV4dH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZXhwb3J0IHtcbiAgICBjcmVhdGVFeHByZXNzaW9uTWFuYWdlclxufTtcblxuZnVuY3Rpb24gZ2V0VmFyaWFibGVzRnJvbU5vZGUoYWNjLCBub2RlKXtcbiAgICBpZihub2RlLnR5cGUgPT09IFwiSWRlbnRpZmllclwiKXtcbiAgICAgICAgcmV0dXJuIFsuLi5hY2MsIG5vZGUubmFtZV07XG4gICAgfWVsc2UgaWYobm9kZS5hcmd1bWVudCl7XG4gICAgICAgIHJldHVybiBbLi4uYWNjLCAuLi5ub2RlLmFyZ3VtZW50LnR5cGUgPT09IFwiSWRlbnRpZmllclwiICYmIGdldFZhcmlhYmxlc0Zyb21Ob2RlKGFjYywgbm9kZS5hcmd1bWVudCkgfHxbXV07XG4gICAgfWVsc2UgaWYobm9kZS5vcGVyYXRvcil7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAuLi5ub2RlLmxlZnQudHlwZSAhPT0gXCJMaXRlcmFsXCIgJiYgZ2V0VmFyaWFibGVzRnJvbU5vZGUoYWNjLCBub2RlLmxlZnQpfHxbXSxcbiAgICAgICAgICAgIC4uLm5vZGUucmlnaHQudHlwZSAhPT0gXCJMaXRlcmFsXCIgJiYgZ2V0VmFyaWFibGVzRnJvbU5vZGUoYWNjLCBub2RlLnJpZ2h0KXx8W11dO1xuICAgIH1lbHNlIGlmKG5vZGUuQ2FsbEV4cHJlc3Npb24pe1xuICAgICAgICByZXR1cm4gWy4uLihub2RlLmFyZ3VtZW50cy5tYXAoYT0+Z2V0VmFyaWFibGVzRnJvbU5vZGUoYWNjLCBhKSkuZmxhdE1hcCgpKV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVWYWx1ZUZyb21BcnJheShhcnJheSwgdmFsdWUpe1xuICAgIGNvbnN0IGluZGV4ID0gYXJyYXkuaW5kZXhPZih2YWx1ZSk7XG4gICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gfmluZGV4O1xufSJdLCJuYW1lcyI6WyJKc2VwIiwiRVZFTlQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBT0E7O0lBRUc7SUFDRixJQUFNLFdBQVcsR0FBRyxVQUFDLFlBQVksRUFBQTtJQUM5QixJQUFBLElBQU0sS0FBSyxHQUFBLFFBQUEsQ0FBQSxFQUFBLEVBQU8sWUFBWSxDQUFDLENBQUM7SUFDaEMsSUFBQSxJQUFNLElBQUksR0FBbUQ7WUFDekQsUUFBUSxFQUFDLElBQUksR0FBRyxFQUFFO1NBQ3JCLENBQUM7SUFDRixJQUFBLElBQU0sTUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRTtJQUM1QixRQUFBLEdBQUcsRUFBQyxVQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFBOztJQUNqQixZQUFBLElBQUksUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDekIsSUFBRyxRQUFRLEtBQUssS0FBSztJQUFFLGdCQUFBLE9BQU8sSUFBSSxDQUFDO2dCQUNuQyxJQUFNLGVBQWUsR0FBRyxVQUFDLFFBQVEsRUFBQTtJQUM3QixnQkFBQSxRQUFRLENBQUM7SUFDTCxvQkFBQSxRQUFRLEVBQUMsS0FBSztJQUNkLG9CQUFBLFFBQVEsRUFBQSxRQUFBO0lB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QUcsRUFBRTtJQUNoQixDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQ2hCLENBQUMsVUFBVSxHQUFHLEVBQUU7SUFDaEIsQ0FBQyxXQUFXLEVBQUUsRUFBRTtJQUNoQixDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQ2hCLENBQUMsV0FBVyxFQUFFLEVBQUU7SUFDaEIsQ0FBQyxXQUFXLEVBQUUsRUFBRTtJQUNoQixDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQ2hCLENBQUMsV0FBVyxFQUFFLEVBQUU7SUFDaEIsQ0FBQyxXQUFXLEVBQUUsRUFBRTtJQUNoQixDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQ2hCLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDaEI7QUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLEVBQUU7SUFDWixFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ1IsRUFBRSxHQUFHLEVBQUUsQ0FBQztJQUNSLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDUixFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ1IsRUFBRTtBQUNGO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxVQUFVLEVBQUU7SUFDYixFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDMUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUN0QyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ2xDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQzVCLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztJQUNoQixFQUFFLEdBQUcs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QUFDO0lBQzFCLFFBQUEsSUFBSSxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQSxFQUFLLFFBQUMsQ0FBQyxJQUFJLENBQUMsSUFBQztJQUN4QixRQUFBLElBQUksRUFBRSxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUEsRUFBSyxRQUFDLENBQUMsSUFBSSxDQUFDLElBQUM7SUFDeEIsUUFBQSxHQUFHLEVBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFBLEVBQUssUUFBQyxDQUFDLEdBQUcsQ0FBQyxJQUFDO0lBQ3RCLFFBQUEsR0FBRyxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQSxFQUFLLFFBQUMsQ0FBQyxHQUFHLENBQUMsSUFBQztJQUN0QixRQUFBLElBQUksRUFBRSxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUEsRUFBSyxRQUFDLENBQUMsSUFBSSxDQUFDLElBQUM7SUFDeEIsUUFBQSxJQUFJLEVBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFBLEVBQUssUUFBQyxDQUFDLElBQUksQ0FBQyxJQUFDO0lBQ3hCLFFBQUEsR0FBRyxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQSxFQUFLLFFBQUMsQ0FBQyxHQUFHLENBQUMsSUFBQztJQUN0QixRQUFBLEdBQUcsRUFBRSxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUEsRUFBSyxRQUFDLENBQUMsR0FBRyxDQUFDLElBQUM7SUFDdEIsUUFBQSxHQUFHLEVBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFBLEVBQUssUUFBQyxDQUFDLEdBQUcsQ0FBQyxJQUFDO0lBQ3RCLFFBQUEsR0FBRyxFQUFFLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQSxFQUFLLFFBQUMsQ0FBQyxHQUFHLENBQUMsSUFBQztJQUN0QixRQUFBLEdBQUcsRUFBRSxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUEsRUFBSyxRQUFDLENBQUMsR0FBRyxDQUFDLElBQUM7SUFDdEIsUUFBQSxJQUFJLEVBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFLLEVBQUEsUUFBQyxJQUFB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
