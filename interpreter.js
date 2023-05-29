/// from StackOverflow
function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
            !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

const types = {
    STRING: "string",
    NUMBER: "number",
    PRIMITIVE: "primitive",
    OBJECT: "object",
    MESSAGE: "message",
    BLOCK: "block"
};

/**
 * NOTE: Primitives must not evaluate code.
 */
const prim = {
    NULL: 0,
    
    NUMBERS_ADD: 1,
    NUMBERS_SUBTRACT: 2,
    NUMBERS_DIVIDE: 3,
    NUMBERS_MULTIPLY: 4,
    NUMBERS_MOD: 5,
    NUMBERS_MINUS1: 6,
    NUMBERS_GREATER_THAN: 7,
    NUMBERS_LESSER_THAN: 8,
    NUMBERS_EQ: 9,

    BLOCK_CONTROL_STOP: 100,
    BLOCK_RUN: 101,
    BLOCK_RUN_CURRENT: 102,

    PROTO_BLOCK_SET: 200,

    BASE_COLON_PROCESS_BLOCK: 300,
    BASE_DOES_NOT_UNDERSTAND: 301,
    BASE_DUP: 302,
    BASE_SWAP: 303,
    BASE_OVER: 304,
    BASE_ROT: 305,
    BASE_STACK: 306,
    BASE_COLON: 307,
    BASE_TRUE: 308,
    BASE_FALSE: 309,
    BASE_PROTO: 310,

    GENERAL_POP: 500,
    GENERAL_SET: 501,
    

    OTHER_CONSOLE_SAY: 700,
};

/**
 * Primitives must not evaluate/execute blocks of code.
 * @param {dJSContextFrame} ctx Current execution context
 * @param {dPrimitive} primObj current primitive
 */
function executePrimitive(ctx, primObj) {
    let numVal;

    switch (primObj.numberVal) {
        case prim.NULL: break;

        case prim.NUMBERS_ADD: dNumber.primitives.add(ctx); break;
        case prim.NUMBERS_SUBTRACT: dNumber.primitives.subtract(ctx); break;
        case prim.NUMBERS_MULTIPLY: dNumber.primitives.multiply(ctx); break;
        case prim.NUMBERS_DIVIDE: dNumber.primitives.divide(ctx); break;
        case prim.NUMBERS_MOD: dNumber.primitives.mod(ctx); break;
        case prim.NUMBERS_MINUS1: dNumber.primitives.minus1(ctx); break;
        case prim.NUMBERS_LESSER_THAN: dNumber.primitives.lesser_than(ctx); break;
        case prim.NUMBERS_GREATER_THAN: dNumber.primitives.greater_than(ctx); break;
        case prim.NUMBERS_EQ: dNumber.primitives.eq(ctx); break;

        case prim.BLOCK_CONTROL_STOP: dBlock.primitives.controlStop(ctx); break; 

        case prim.BASE_COLON_PROCESS_BLOCK: dColonObject.processBlock(ctx); break;
        case prim.BASE_DOES_NOT_UNDERSTAND: dBase.primitives.doesNotUnderstand(ctx); break;
        case prim.BASE_DUP: dBase.primitives.dup(ctx); break;
        case prim.BASE_SWAP: dBase.primitives.swap(ctx); break;
        case prim.BASE_OVER: dBase.primitives.over(ctx); break;
        case prim.BASE_ROT: dBase.primitives.rot(ctx); break;
        case prim.BASE_STACK: ctx.stack.push(dStack(ctx)); break;
        case prim.BASE_COLON: ctx.stack.push(dColonObject()); break;
        case prim.BASE_TRUE: ctx.stack.push(dBoolean(true)); break;
        case prim.BASE_FALSE: ctx.stack.push(dBoolean(false)); break;
        case prim.BASE_PROTO: ctx.stack.push(dProto()); break;

        case prim.PROTO_BLOCK_SET: dProto.semicolon(ctx); break;

        /** Useful for muting objects */
        case prim.GENERAL_POP: ctx.stack.pop(); break;
        case prim.GENERAL_SET: dSetter.primitive(ctx); break;

        case prim.OTHER_CONSOLE_SAY: dConsoleObject.say(ctx); break;

        default:
            throw "Unsupported primitive";
    }
}

// messages are objects which hold objects . . . so they hold themselves
let objectID = 0;
function dObject() {
    let native = {
        objID: objectID++,
        type: types.OBJECT,
        stringVal: "",
        numberVal: 0,
        nullMessage: false,
        blockContent: [],
        onBody: null, // is a message object . . . (acts like a interface)
        doesNotUnderstand: null, // is a message object
        interface: {}, // contains message blocks
        extern: null,
        stopped: false, // whether a block has stopped execution or not
    };
    return native;
}

function dPrimitive(id) {
    let obj = dObject();
    obj.type = types.PRIMITIVE;
    obj.numberVal = id;
    return obj;
}

// Interface is a block for interfaces but doesn't actually have an interface, unlike an actual block
function dInterface(val) {
    let obj = dObject();
    obj.type = types.BLOCK;
    if (val !== undefined) {
        if (Array.isArray(val)) {
            obj.blockContent = val;
        } else {
            obj.blockContent.push(val);
        }
    }

    return obj;
}

// TODO: add language level interface with this object structure
function dBlock(val) {
    let obj = dObject();
    obj.type = types.BLOCK;
    if (val !== undefined) {
        if (Array.isArray(val)) {
            obj.blockContent = val;
        } else {
            obj.blockContent.push(val);
        }
    }

    function dControl() {
        let ctrl = dObject();
        ctrl.interface = {
            "stop": dInterface([dSingleQuoteObject(), obj, dPrimitive(prim.BLOCK_CONTROL_STOP)])
        };
        return ctrl;
    }

    obj.interface = {
        "run": dInterface([dSingleQuoteObject(), obj, dPrimitive(prim.BLOCK_RUN)]),
        "run/current": dInterface([dSingleQuoteObject(), obj, dPrimitive(prim.BLOCK_RUN_CURRENT)]),
        "control": dInterface(dControl()),
    };

    obj.extern = {
        run: (stack) => { 
            const container = dJSContextContainer(dJSContextFrame(obj, null, stack || [] ));
            executeStart(container, true); 
        }
    };

    return obj;
}
dBlock.primitives = {
    controlStop(ctx) {
        const block = ctx.stack.pop();
        block.stopped = true;
    }
}

function dMessage(key) {
    let obj = dObject();
    obj.type = types.MESSAGE;
    obj.stringVal = key;
    return obj;
}

function dMute() {
    let obj = dObject();
    obj.type = types.OBJECT;
    obj.onBody = dInterface(dPrimitive(prim.GENERAL_POP));
    obj.interface = {};
    return obj;
}

function dFalse() {
    let obj = dObject();

    var base = dBase();

    obj.interface = {
        "as-bool": dInterface([ base, dBlock(dMessage("false")) ]),
        "as-string": dInterface(dString("false")),
        "not": dInterface([base, dBlock(dMessage("true"))]),
        "or": dInterface([ dBlock(dMessage("as-bool")) ]),
        "and": dInterface([
            dMessage("drop"),
            dMessage("as-bool")
        ]),
        "else": dInterface(dObject()),
        "if": dInterface(dMute()),
    };
    
    return obj;
}

function dTrue() {
    let obj = dObject();

    var base = dBase();

    obj.interface = {
        "as-bool": dInterface([ base, dBlock(dMessage("true")) ]),
        "as-string": dInterface(dString("true")),
        "not": dInterface([base, dBlock(dMessage("false"))]),
        "and": dInterface([ dBlock(dMessage("as-bool")) ]),
        "or": dInterface([
            dMessage("drop"),
            dMessage("as-bool")
        ]),
        "if": dInterface(dObject()),
        "else": dInterface(dMute()),
    };

    return obj;
}

function dBoolean(val) {
    if (val) return dTrue();
    return dFalse();
}

function dNumber(val) {
    let obj = dObject();
    obj.type = types.NUMBER;
    obj.numberVal = val;

    // TODO: complete the operations
    obj.interface = {
        "+": dInterface([obj, dPrimitive(prim.NUMBERS_ADD)]),
        "-": dInterface([obj, dPrimitive(prim.NUMBERS_SUBTRACT)]),
        "*": dInterface([obj, dPrimitive(prim.NUMBERS_MULTIPLY)]),
        "/": dInterface([obj, dPrimitive(prim.NUMBERS_DIVIDE)]),
        "1-": dInterface([obj, dPrimitive(prim.NUMBERS_MINUS1)]),
        "<": dInterface([obj, dPrimitive(prim.NUMBERS_LESSER_THAN)]),
        ">": dInterface([obj, dPrimitive(prim.NUMBERS_GREATER_THAN)]),
        "=": dInterface([obj, dPrimitive(prim.NUMBERS_EQ)]),
        "%": dInterface([obj, dPrimitive(prim.NUMBERS_MOD)]),
    }
    
    return obj;
}
dNumber.primitives = {
    add: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dNumber(numVal + (ctx.stack.pop()).numberVal));
    },
    subtract: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dNumber(numVal - (ctx.stack.pop()).numberVal));
    },
    multiply: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dNumber(numVal * (ctx.stack.pop()).numberVal));
    },
    divide: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dNumber(numVal / (ctx.stack.pop()).numberVal));
    },
    mod: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dNumber(numVal % (ctx.stack.pop()).numberVal));
    },
    minus1: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dBoolean(numVal < (ctx.stack.pop()).numberVal));
    },
    lesser_than: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dBoolean(numVal < (ctx.stack.pop()).numberVal));
    },
    greater_than: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dBoolean(numVal > (ctx.stack.pop()).numberVal));
    },
    eq: (ctx) => {
        const numVal = ctx.stack.pop().numberVal;
        ctx.stack.push(dBoolean(numVal === (ctx.stack.pop()).numberVal));
    },
};

// TODO: flesh out string object
function dString(val) {
    let obj = dObject();
    obj.type = types.STRING;
    obj.stringVal = val;
    
    obj.interface = {

    };
    return obj;
}


function dConsoleObject() {
    let obj = dObject();
    obj.interface = {
        "say": dInterface(dPrimitive(prim.OTHER_CONSOLE_SAY))
    };
    return obj;
}
dConsoleObject.say = (ctx)=>{
    var val = ctx.stack.pop();
    switch (val.type) {
        case types.NUMBER:
            console.log(val.numberVal);
            break;
        case types.STRING:
            console.log(val.stringVal);
            break;
        case types.OBJECT:
            console.log(val);
            break;
    }
};

function dSetter(obj, name) {
    return dInterface([dString(name), obj, dPrimitive(prim.GENERAL_SET)]);
}
dSetter.primitive = (ctx)=>{
    const obj = ctx.stack.pop();
    const nameObj = ctx.stack.pop();
    const val = ctx.stack.pop();
    const name = nameObj.stringVal;
    // wrap non-block types in a block
    if (val.type !== types.BLOCK) {
        obj.interface[name] = dInterface(val);
    }
    else {
        obj.interface[name] = val;
    }
};

// TODO: Support prototypal inheritance
function dProto() {
    let obj = dObject();

    obj.interface = {
        ';': dInterface([obj, dPrimitive(prim.PROTO_BLOCK_SET)]),
        'me': dInterface(obj)
    };

    return obj;
}

dProto.semicolon = (ctx)=>{
    const obj = ctx.stack.pop();
    const def = ctx.stack.pop();
    var name = def.blockContent.shift();
    obj.interface[name.stringVal] = def;
    obj.interface[name.stringVal + ":"] = dSetter(obj, name.stringVal);
};


function applyParams(ctx, block, startsWith, startsWithNot = "") {
    var params = {};
    // get everything that looks like @<word>
    for (var i = 0; i < block.blockContent.length; i ++) {
        var blockObj = block.blockContent[i];
        if (blockObj.type == types.MESSAGE) {
            var message = blockObj.stringVal;
            // Check if it's a matched pattern (@ or @@)
            if (message.startsWith(startsWith) && (!message.startsWith(startsWithNot) || startsWithNot == "" )) {
                if (!params.hasOwnProperty(message)) {
                    params[message] = ctx.stack.pop();
                }
                // set the meta field to be a null message
                blockObj.nullMessage = true;
            }
        }
    }

    // build the parameter names list
    var paramList = [];
    var paramStartLength = startsWith.length;
    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            paramList.push(key.substring(paramStartLength));
        }
    }

    function applyParams(block) {
        for (var i = 0; i < block.blockContent.length; i ++) {
            var paramObj = block.blockContent[i];
            if (paramObj.type == types.MESSAGE) {
                var paramName = paramObj.stringVal;
                if (paramList.indexOf(paramName) != -1) {
                    paramObj.blockContent[0] = params[startsWith+paramName];
                }
            }
            else if (paramObj.type == types.BLOCK) {
                applyParams(paramObj);
            }
        }
    }
    applyParams(block);
}

// TODO: Support enclosing stack objects with special syntax
function dColonObject() {
    let obj = dObject();
    obj.onBody = dInterface(dPrimitive(prim.BASE_COLON_PROCESS_BLOCK));
    return obj;
}
dColonObject.processBlock = (ctx)=>{
    let wordBlock = ctx.stack.pop();
    applyParams(ctx, wordBlock, "@", "@@");
    ctx.stack.push(wordBlock);
};

function dSingleQuoteObject() {
    let obj = dObject();
    obj.onBody = dInterface(dPrimitive(prim.NULL));
    return obj;
};

// Represents a node in the stack
function dStackNode(value, nodeBelow) {
    let obj = dObject();

    obj.interface = {
        "value": value == null? dInterface() : dInterface(value),
        "node-below": nodeBelow == null || nodeBelow == undefined? dInterface() : dInterface(nodeBelow),
        "node-above": dInterface(),
        "node-above:": dSetter(obj, "node-above"),
        "below?": dInterface(value == null || value == undefined? dBoolean(false) : dBoolean(true)),
        "above?": dInterface(dBoolean(false)),
        "above?:": dSetter(obj, "above?"),
    };

    return obj;
}

/**
 * Represents a stack object that converts the interpreter's stack to a protozoid operable stack
 * @param {dJSContext} ctx The interpreter's context
 * @returns protozoid usable stack which is a copy of the current stack
 */
function dStack(ctx) {
    let obj = dObject();

    var bottom = dStackNode();
    var top = bottom;
    for (var i = 0; i < ctx.stack.length; i ++) {
        var node = dStackNode(ctx.stack[i], top);
        // set above properties for node below
        top.interface["node-above"] = dBlock(node);
        top.interface["above?"] = dBlock(dBoolean(true));
        top = node;
    }
    
    obj.interface = {
        "pop": dInterface([
            dMessage("top"),
            dBlock([
                dMessage("value"),
                dMessage("node-below")
            ]),
            dMessage("top:"),
            dMessage("top"),
            dBlock([
                dMessage(":"), dBlock(),
                dMessage("node-above:"),
                dBoolean(false),
                dMessage("above?:")
            ])
        ]),
        "pop-all": dInterface([
            dMessage("empty?"),
            dBlock([
                dMessage("else"),
                dBlock([
                    dMessage("pop"),
                    dMessage("pop-all")
                ])
            ])
        ]),
        /*
        :[ shift 
            bottom [
                node-above [ value above? ]
                [ 
                    if [ node-above [ node-above ] above: ]
                    else [ false above?: ]
                ]
                node-above [ value ]
            ]
        ];
        */
        "shift": dInterface([
            dMessage("bottom"),
            dBlock([
                dMessage("node-above"),
                dBlock([
                    dMessage("value"),
                    dMessage("above?")
                ]),
                dBlock([
                    dMessage("if"),
                    dBlock([
                        dMessage("node-above"),
                        dBlock(dMessage("node-above")),
                        dMessage("node-above:")
                    ]),
                    dMessage("else"),
                    dBlock([
                        dMessage("false"),
                        dMessage("above?:"),
                        obj, 
                        dBlock([
                            bottom,
                            dMessage("top:")
                        ])
                    ])
                ]),
            ])
        ]),
        "bottom": dInterface(bottom), // basically a null value
        "top": dInterface(top),
        "top:": dSetter(obj, "top"),
        "empty?": dInterface([ dMessage("bottom"), dBlock([ dMessage("above?"), dBlock(dMessage("not")) ]) ])
    };

    return obj;
}

let __base = null;
function dBase() {
    if (__base !== null) return __base;
    let obj = dObject();
    __base = obj;
    
    // push strings or numbers on to the stack. . .
    obj.doesNotUnderstand = dInterface(dPrimitive(prim.BASE_DOES_NOT_UNDERSTAND));

    obj.interface = {
        'stack': dInterface(dPrimitive(prim.BASE_STACK)),
        ':': dInterface(dPrimitive(prim.BASE_COLON)),
        "'": dInterface(dSingleQuoteObject()),
        "true": dInterface(dPrimitive(prim.BASE_TRUE)),
        "false": dInterface(dPrimitive(prim.BASE_FALSE)),
        "proto": dInterface(dPrimitive(prim.BASE_PROTO)),
        "console": dInterface(dConsoleObject()),
        "drop": dInterface(dPrimitive(prim.GENERAL_POP)),
        "dup": dInterface(dPrimitive(prim.BASE_DUP)),
        "swap": dInterface(dPrimitive(prim.BASE_SWAP)),
        "over": dInterface(dPrimitive(prim.BASE_OVER)),
        "rot": dInterface(dPrimitive(prim.BASE_ROT))
    };
    return obj;
}
dBase.primitives = {
    doesNotUnderstand: (ctx) => {
        var arg1 = ctx.stack.pop();
        if (arg1.type == types.MESSAGE) {
            if (isNumeric(arg1.stringVal)) {
                ctx.stack.push(dNumber(Number.parseFloat(arg1.stringVal)));
            } else if (arg1.stringVal.startsWith('"')) {
                ctx.stack.push(dString(arg1.stringVal.substr(1, arg1.stringVal.length -2)))
            } else if (arg1.blockContent.length != 0) {
                ctx.stack.push(arg1.blockContent[0]);
            }
            else {
                throw `can not respond to ${arg1}`;
            }
        } else {
            throw `can not interpret ${arg1}`
        }
    },
    dup(ctx) {
        const n = ctx.stack.pop();
        ctx.stack.push(n);
        ctx.stack.push(n);
    },
    swap(ctx) {
        const valb = ctx.stack.pop();
        const vala = ctx.stack.pop();
        ctx.stack.push(valb);
        ctx.stack.push(vala);
    },
    over(ctx) {
        const n2 = ctx.stack.pop();
        const n1 = ctx.stack.pop();
        ctx.stack.push(n1);
        ctx.stack.push(n2);
        ctx.stack.push(n1);
    },
    rot(ctx) {
        const n3 = ctx.stack.pop();
        const n2 = ctx.stack.pop();
        const n1 = ctx.stack.pop();
        ctx.stack.push(n2);
        ctx.stack.push(n3);
        ctx.stack.push(n1);
    }
}

/** 
 * Turns a string into a message. 
 * This can be ran against any object but will usually be run against the base object.
 * @param str {String} The string to be converted
*/
function stringToBlock(str) {
    let i = 0;
    var message = dBlock();
    var stack = [message];
    function getNextWord() {
        let word = ""; 
        let captured = false;
        let comment = false;
        let closings = 0;
        while (i < str.length && !captured) {
            // skip whitespace or add whitespace to a string
            if (str[i].trim() == '') {
                if (word.startsWith(`"`)) word += str[i];
                else if (comment) word += str[i];
                // if word isn't empty and we hit a whitespace then we captured a word
                else if (word !== "") {
                    captured = true;
                }
            }
            else if (str[i] == '"') {
                if (word.startsWith(`"`)) {
                    word += str[i];
                    captured = true;
                } else {
                    word += str[i];
                }
            }
            else if (comment) {
                if (str[i] == '[') {
                    closings ++;
                }
                else if (str[i] == ']' && closings == 0) {
                    captured = true;
                }
                else if (str[i] == ']') {
                    closings --;
                }
                word += str[i];
            }
            else if (str[i]='[' && word[0] === '!') {
                comment = true;
                word += str[i];
            }
            else if (str[i].trim() != '') {
                word += str[i];
            }
            i ++;
        }
        if (comment) {
            return getNextWord();
        }
        return word;
    }
    var word = getNextWord();
    while (word != "") {
        switch (word) {
            case "[": 
                var innerMessage = dBlock();
                stack[stack.length - 1].blockContent.push(innerMessage);
                stack.push(innerMessage);
                break;
            case "]":
                stack.pop();
                break;
            default:
                stack[stack.length - 1].blockContent.push(dMessage(word));
                break;
        }
        word = getNextWord();
    }

    return message;
}

/**
 * A JS Context frame.
 * @param {dBlock} block Block with messages and embedded objects
 * @param {Array<dObject>} scope Scope-Stack
 * @param {Array<dObject>} stack Value-stack
 * @returns {dJSContext}
 */
function dJSContextFrame(block, scope, stack) {
    const ctx = {
        /** The frame container (pretty much just an array) */
        frameContainer: null,
        /** The primary block being executed */
        block,
        /** The value stack */
        stack: stack || [],
        /** The scope-stack of the current execution context */
        scope: scope || [ dBase() ],
        /** Records the point of execution of the currently executed block*/
        messageStack: [],
        /** Merges the current stack with the value stack below */
        mergeStack: false,
    };
    return ctx;
}

function dJSContextContainer(frame) {
    const container = [frame];
    frame.frameContainer = container;
    return container;
}

/**
 * Helper to define a scoped message. A scoped message is a *block* of messages being walked over from within the context of 
 * the primary executed block. Sort of like a "sub-context".
 * @param {dJSContext} ctx the current context
 * @param {dObject|dBlock} block The block being walked into
 * @param {Number} scopePosition Context of the scope in which this block is being interpreted relative from
 * @param {boolean} scopePop Whether or not to mutate the scope (remove from) after it's done
 * @param {number} messagePosition Position in messages being walked over of the current block
 * @param {boolean} isParamaterized Whether or not to parameterize the current block of messages
 * @returns {ScopedMessage}
 */
function scopedMessage(ctx, block, scopePosition, scopePop, messagePosition, isParamaterized = false) {
    if (isParamaterized) applyParams(ctx, block, "@@");
    return {
        scopePosition,
        block, 
        scopePop,
        messagePosition
    };
}

/**
 * Initiates execution
 * @param {Array<dJSContext>} contextContainer Container of context frames
 * @param {boolean} isParamaterized whether or not this block is parameterized
 */
function executeStart(contextContainer, isParamaterized) {
    let ctx = contextContainer[contextContainer.length - 1];
    const block = ctx.block;
    block.stopped = false;
    ctx.messageStack.push(scopedMessage(ctx, block, ctx.scope.length - 1, false, 0, isParamaterized));
    execute(contextContainer, false);
}

/**
 * Continues execution of a context frame container
 * @param {Array<dJSContext>} contextContainer container of contexts 
 * @param {boolean} runFrames Whether or not to manually run and destack (which would normally happen automatically)
 * @returns {void}
 */
function execute(contextContainer, runFrames = false) {
    let ctx = contextContainer[contextContainer.length - 1];
    const runningBlock = ctx.block;
    while (ctx.messageStack.length > 0 && !runningBlock.stopped) {
        const scoped = ctx.messageStack[ctx.messageStack.length - 1];
        const block = scoped.block;
        const scope = scoped.scopePosition;
        const messagePosition = scoped.messagePosition;

        // If we've reached the end of the currently scoped block's length of messages pop it off the message stack
        if (block.blockContent.length == messagePosition) {
            ctx.messageStack.pop();
            if (scoped.scopePop) {
                ctx.scope.pop();
            }
        } else {

            // obj could be another block, a primitive, or a message
            const obj = block.blockContent[messagePosition];
            // console.log(obj); // Prints out the messages
            // console.log("stack is:", [].concat(ctx.stack));
            // console.log("scope is:", [].concat(ctx.scope));
            
            // increase the message position for the current stack by 1
            scoped.messagePosition ++;

            // we've encountered a block (potentially a block of messages and more blocks)
            // that means we get the next object from the value stack and put it in scope
            if (obj.type === types.BLOCK) {
                const nextObj = ctx.stack.pop();
                // put object from the stack onto scope
                ctx.scope.push(nextObj);

                // (magic) if nextObj has onBody then we put the stepped onto block on to the value stack 
                if (nextObj.onBody !== null) {
                    // instead of entering the obj for processing messages we process the onBody block for processing blocks
                    ctx.messageStack.push(scopedMessage(ctx, nextObj.onBody, ctx.scope.length - 1, true, 0, true));
                    ctx.stack.push(obj);
                } 
                // otherwise, we just enter a new scoped message (which is basically entering a block, hence putting on to the message stack and stack position)
                else {
                    ctx.messageStack.push(scopedMessage(ctx, obj, ctx.scope.length - 1, true, 0, false));
                }
            } 
            // perform primitive
            else if (obj.type === types.PRIMITIVE) { 
                switch(obj.numberVal) {
                    // Interperter based message
                    case prim.BLOCK_RUN: {
                        var nextBlock = ctx.stack.pop();
                        var nestedCtx = dJSContextFrame(nextBlock);
                        nestedCtx.mergeStack = true;
                        contextContainer.push(nestedCtx);
                        executeStart(contextContainer, true);
                    } break;
                    // Interpreter based message
                    case prim.BLOCK_RUN_CURRENT: {
                        var nextBlock = ctx.stack.pop();
                        contextContainer.push(dJSContextFrame(nextBlock, ctx.scope, ctx.stack));
                        executeStart(contextContainer, true);
                    } break;
                    default: executePrimitive(ctx, obj);
                }
            } 
            // interpret message (if not null)
            else if (obj.type === types.MESSAGE) {
                if (!obj.nullMessage) {
                    for (var i = scope; i >= 0; i--) {
                        // if the interface responds to the message's value (string val) then we enter 
                        if (ctx.scope[i].interface.hasOwnProperty(obj.stringVal)) {
                            ctx.messageStack.push(scopedMessage(ctx, ctx.scope[i].interface[obj.stringVal], i, false, 0, true));
                            break;
                        } 
                        // The interface may be able to respond to messages it does not know
                        else if (ctx.scope[i].doesNotUnderstand !== null) {
                            ctx.stack.push(obj);
                            ctx.messageStack.push(scopedMessage(ctx, ctx.scope[i].doesNotUnderstand, i, false, 0, true));
                        }
                    }
                }
            } else {
                // put dat object on duh stack, mane
                ctx.stack.push(obj);
            }
        }
    }
    contextContainer.pop();
    if (contextContainer.length > 0) {
        // Merge stacks
        if (ctx.mergeStack) {
            var ctxBelow = contextContainer[contextContainer.length - 1];
            ctxBelow.stack.concat(ctx.stack);
        }
        if (runFrames) { execute(contextContainer, runFrames); }
    }
}

var code = `
proto [
    : [ factorial dup 1 [ < ] [ 
        if [ dup [ 1- ] factorial [ * ] ]
    ] ] ;     : [ three ] ;
    ![
    3 three:
    ![this is a comment :) ]
    ![this is also a comment]
    ![comment: hello]
    three console [ say ] ]
    5 three:
    three factorial
    "hello world!" three: console [ three say ]
    12 5 : [ @five @@twelve five twelve [ + ] ] [ run/current ]
]
console [ say say ]
`;

const code2 = `
: [ 5 [ + ] dup 10 [ = ] [ if [ drop exit ] ] "isn't 10: " console [ say say ] ] 
proto [ 
    dup [ control ] : [ exit @control control [ stop ] ] ;
    ![ or written as
        dup : [ exit @block block [ control [ stop ] ] ] ;
    ]
    dup 
    3 swap [ run/current ] ![ prints "isn't 10: 8"]
    "hello" console [ say ]
    5 swap [ run/current ] ![ prints nothing cause 5 + 5 = 10 ]
]
`;
/*
    code 3 should print:
    12 
    4
    5
    6
*/
const code3 = `
proto [
    12 : [ @twelve 
        twelve console [ say ]
        : [ do-it @@num num console [ say ] ] ;
    ] [ run/current ]

    4 console [ say ]
    5 do-it
    6 do-it
]
`;
const code4 = `
console [
    
    1 2 3
    stack [
        proto [
            : [ print-empty 
                empty? [
                    if [ "is empty!!!!!!" say ]
                    else [ "is not empty!" say ]
                ]
            ] ;
            print-empty 
            pop say
            print-empty
            pop say
            print-empty
            pop say
            print-empty
        ]
    ]
    say say say
    1 2 3
    stack [
        proto [
            : [ print-empty 
                empty? [
                    if [ "is empty!!!!!!" say ]
                    else [ "is not empty!" say ]
                ]
            ] ;
            shift say
            shift say
            shift say
        ]
    ]
    say say say
]
`;
// Test pop all
const codePopAll = `
console [
    1 2 3
    stack [
        say say say
        pop-all
    ]
    say say say
]
`;

(()=>{
    var block = stringToBlock(codePopAll);
    // console.log(block);
    block.extern.run();
})();