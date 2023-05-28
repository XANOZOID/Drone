/// from StackOverflow
function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
            !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

const types = {
    STRING: "string",
    NUMBER: "number",
    ARRAY: "array",
    PRIMITIVE: "primitive",
    OBJECT: "object",
    MESSAGE: "message",
    BLOCK: "block"
};

// messages are objects which hold objects . . . so they hold themselves
function dObject() {
    let native = {
        type: types.OBJECT,
        stringVal: "",
        numberVal: 0,
        nullMessage: false,
        blockContent: [],
        primitive: (ctx)=>{}, // function that operates on context
        onBody: null, // is a message object . . . (acts like a interface)
        doesNotUnderstand: null, // is a message object
        interface: {}, // contains message blocks
        extern: null,
        stopped: false, // whether a block has stopped execution or not
    };
    return native;
}

function dPrimitive(fn) {
    let obj = dObject();
    obj.type = types.PRIMITIVE;
    obj.primitive = fn;
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
            "stop": dInterface(dPrimitive((ctx)=>{
                obj.stopped = true;
            }))
        };
        return ctrl;
    }

    obj.interface = {
        "run": dInterface(dPrimitive((ctx)=> {
            var exCtx = executeBlock(obj, dContext(), true);
            ctx.stack = ctx.stack.concat(exCtx.stack);
        })),
        "run/current": dInterface(dPrimitive((ctx)=>{
            executeBlock(obj, dContext(ctx.scope, ctx.stack, true));
        })),
        "control": dInterface(dControl()),
    };

    obj.extern = {
        run: (stack) => { executeBlock(obj, dContext(null, stack || [] ), true); }
    };

    return obj;
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
    obj.onBody = dInterface(dPrimitive((ctx)=> {
        // same as "ignore this entire message-block"
        ctx.stack.pop();
    }));
    obj.interface = {};
    return obj;
}

function dFalse() {
    let obj = dObject();

    var base = dBase();

    obj.interface = {
        "as-bool": dInterface([ base, dBlock(dMessage("false")) ]),
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
        "+": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val + (ctx.stack.pop()).numberVal));
        })),
        "-": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val - (ctx.stack.pop()).numberVal));
        })),
        "*": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val * (ctx.stack.pop()).numberVal));
        })),
        "/": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val / (ctx.stack.pop()).numberVal));
        })),
        
        "1-": dInterface(dPrimitive((ctx) => ctx.stack.push(dNumber(val - 1)) )),

        "<": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dBoolean(val < (ctx.stack.pop()).numberVal));
        })),
        ">": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dBoolean(val > (ctx.stack.pop()).numberVal));
        })),
        "=": dInterface(dPrimitive((ctx) => {
            ctx.stack.push(dBoolean(val === (ctx.stack.pop()).numberVal));
        })),
    }
    
    return obj;
}

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
        "say": dInterface(dPrimitive((ctx)=>{
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
        }))
    };
    return obj;
}


function dSetter(obj, name) {
    return dInterface(dPrimitive((ctx)=>{
        const val = ctx.stack.pop();
        // wrap non-block types in a block
        if (val.type !== types.BLOCK) {
            obj.interface[name] = dInterface(val);
        }
        else {
            obj.interface[name] = val;
        }
    }))
}

// TODO: Support prototypal inheritance
function dProto() {
    let obj = dObject();

    obj.interface = {
        // TODO: Create setters based on name - IE ":name"
        ';': dInterface(dPrimitive((ctx)=>{
            const def = ctx.stack.pop();
            var name = def.blockContent.shift();
            obj.interface[name.stringVal] = def;
            obj.interface[name.stringVal + ":"] = dSetter(obj, name.stringVal);
        })),
        'me': dInterface(dPrimitive((ctx => ctx.stack.push(obj))))
    };

    return obj;
}

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
function colonObject() {
    let obj = dObject();

    obj.onBody = dInterface(dPrimitive((ctx)=>{
        let wordBlock = ctx.stack.pop();
        applyParams(ctx, wordBlock, "@", "@@");
        ctx.stack.push(wordBlock);
    }));

    return obj;
}


// Represents a node in the stack
function dStackNode(value, nodeBelow) {
    let obj = dObject();

    obj.interface = {
        "value": value == null? dBlock() : dBlock(value),
        "node-below": nodeBelow == null || nodeBelow == undefined? dBlock() : dBlock(nodeBelow),
        "node-above": dBlock(),
        "node-above:": dSetter(obj, "node-above"),
        "below?": dBlock(value == null || value == undefined? dBoolean(false) : dBoolean(true)),
        "above?": dBlock(dBoolean(false)),
        "above?:": dSetter(obj, "above?"),
    };

    return obj;
}

/**
 * Represents a stack object that converts the interpreter's stack to a protozoid operable stack
 * @param {dContext} ctx The interpreter's context
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
        "pop": dBlock([
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
        "shift": dBlock([
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
        "bottom": dBlock(bottom), // basically a null value
        "top": dBlock(top),
        "top:": dSetter(obj, "top"),
        "empty?": dBlock([ dMessage("bottom"), dBlock([ dMessage("above?"), dBlock(dMessage("not")) ]) ])
    };

    return obj;
}

function dBase() {
    let obj = dObject();
    obj.type = types.OBJECT;
    
    // push strings or numbers on to the stack. . .
    obj.doesNotUnderstand = dInterface(dPrimitive((ctx)=>{
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
                console.error("cannot respond to:", arg1);
                throw `can not respond to ${arg1}`;
            }
        } else {
            throw `can not interpret ${arg1}`
        }
    }));

    obj.interface = {
        'stack': dInterface(dPrimitive((ctx)=>{
            ctx.stack.push(dStack(ctx));
        })),
        ':': dInterface(dPrimitive((ctx)=>{
            ctx.stack.push(colonObject());
        })),
        "true": dInterface(dPrimitive((ctx)=>{
            ctx.stack.push(dBoolean(true));
        })),
        "false": dInterface(dPrimitive((ctx)=>{
            ctx.stack.push(dBoolean(false));
        })),
        "proto": dInterface(dPrimitive((ctx)=>{
            ctx.stack.push(dProto());
        })),
        "console": dInterface(dPrimitive((ctx)=> {
            ctx.stack.push(dConsoleObject());
        })),
        "drop": dInterface(dPrimitive((ctx)=> ctx.stack.pop())),
        "dup": dInterface(dPrimitive((ctx)=>{
            const n = ctx.stack.pop();
            ctx.stack.push(n);
            ctx.stack.push(n);
        })),
        "swap": dInterface(dPrimitive((ctx)=>{
            const valb = ctx.stack.pop();
            const vala = ctx.stack.pop();
            ctx.stack.push(valb);
            ctx.stack.push(vala);
        })),
        "over": dInterface(dPrimitive((ctx)=>{
            const n2 = ctx.stack.pop();
            const n1 = ctx.stack.pop();
            ctx.stack.push(n1);
            ctx.stack.push(n2);
            ctx.stack.push(n1);
        })),
        "rot": dInterface(dPrimitive((ctx)=>{
            const n3 = ctx.stack.pop();
            const n2 = ctx.stack.pop();
            const n1 = ctx.stack.pop();
            ctx.stack.push(n2);
            ctx.stack.push(n3);
            ctx.stack.push(n1);
        }))
    };
    return obj;
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

function dContext(scope, stack) {
    let ctx = {
        stack: stack || [],
        scope: scope || [ dBase() ],
        messageStack: [],
        messageStackPosition: []
    };
    return ctx;
}

function executeBlock(block, context, isParamaterized) {
    let ctx = context;
    const message = block;
    message.stopped = false;
    function scopedMessage(message, scopePosition, scopePop, isParamaterized = false) {
        if (isParamaterized) applyParams(ctx, message, "@@");
        return {
            scopePosition,
            message, 
            scopePop
        };
    }
    // Apply values for @@<identifier>
    ctx.messageStack.push(scopedMessage(message, context.scope.length - 1, false, isParamaterized));
    ctx.messageStackPosition.push(0);
    while (ctx.messageStack.length > 0 && !message.stopped) {
        const scoped = ctx.messageStack[ctx.messageStack.length - 1];
        const block = scoped.message;
        const scope = scoped.scopePosition;

        if (block.blockContent.length == ctx.messageStackPosition[ctx.messageStackPosition.length - 1]) {
            ctx.messageStack.pop();
            ctx.messageStackPosition.pop();
            if (scoped.scopePop) {
                ctx.scope.pop();
            }
        } else {

            // obj could be another block, a primitive, or a message
            const obj = block.blockContent[ctx.messageStackPosition[ctx.messageStackPosition.length - 1]];
            // console.log(obj); // Prints out the messages
            // console.log("stack is:", [].concat(ctx.stack));
            
            // increase the message position for the current stack by 1
            ctx.messageStackPosition[ctx.messageStackPosition.length - 1] = ctx.messageStackPosition[ctx.messageStackPosition.length - 1] + 1;

            // we've encountered a block (potentially a block of messages and more blocks)
            // that means we get the next object from the value stack and put it in scope
            if (obj.type === types.BLOCK) {
                const nextObj = ctx.stack.pop();
                // put object from the stack onto scope
                ctx.scope.push(nextObj);

                // (magic) if nextObj has onBody then we put the stepped onto block on to the value stack 
                if (nextObj.onBody !== null) {
                    // instead of entering the obj for processing messages we process the onBody block for processing blocks
                    ctx.messageStack.push(scopedMessage(nextObj.onBody, ctx.scope.length - 1, true, true));
                    ctx.messageStackPosition.push(0);
                    ctx.stack.push(obj);
                } 
                // otherwise, we just enter a new scoped message (which is basically entering a block, hence putting on to the message stack and stack position)
                else {
                    ctx.messageStack.push(scopedMessage(obj, ctx.scope.length - 1, true, false));
                    ctx.messageStackPosition.push(0);
                }
            } 
            // perform primitive
            else if (obj.type === types.PRIMITIVE) { obj.primitive(ctx); } 
            // interpret message (if not null)
            else if (obj.type === types.MESSAGE) {
                if (!obj.nullMessage) {
                    for (var i = scope; i >= 0; i--) {
                        // if the interface responds to the message's value (string val) then we enter 
                        if (ctx.scope[i].interface.hasOwnProperty(obj.stringVal)) {
                            ctx.messageStack.push(scopedMessage(ctx.scope[i].interface[obj.stringVal], i, false, true));
                            ctx.messageStackPosition.push(0);
                            break;
                        } 
                        // The interface may be able to respond to messages it does not know
                        else if (ctx.scope[i].doesNotUnderstand !== null) {
                            ctx.stack.push(obj);
                            ctx.messageStack.push(scopedMessage(ctx.scope[i].doesNotUnderstand, i, false, true));
                            ctx.messageStackPosition.push(0);
                        }
                    }
                }
            } else {
                // put dat object on duh stack, mane
                ctx.stack.push(obj);
            }
        }
    }
    return ctx;
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
    5 swap [ run/current ] ![ prints nothing cause 5 + 5 = 10 ]
]
`;
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
var block = stringToBlock(code4);
// console.log(block);
block.extern.run();