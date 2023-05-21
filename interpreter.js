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
        blockContent: [],
        primitive: (ctx)=>{}, // function that operates on context
        onBody: null, // is a message object . . . (acts like a interface)
        doesNotUnderstand: null, // is a message object
        interface: {}, // contains message blocks
        extern: null,
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

    obj.interface = {
        "run": dInterface(dPrimitive((ctx)=> {
            var exCtx = executeBlock(obj, dContext());
            ctx.stack = ctx.stack.concat(exCtx.stack);
        })),
        "run/current": dInterface(dPrimitive((ctx)=>{
            executeBlock(obj, dContext(ctx.scope, ctx.stack));
        }))
    };

    obj.extern = {
        run: (stack) => { executeBlock(obj, dContext(null, stack || [] )); }
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

function dBoolean(val) {
    let obj = dObject();
    obj.type = types.OBJECT;
    
    if (val) {
        obj.interface["if"] = dInterface(dObject());
        obj.interface["else"] = dInterface(dMute());
    } else {
        obj.interface["if"] = dInterface(dMute());
        obj.interface["else"] = dInterface(dObject());
    }
    // TODO: add boolean logic interface
    return obj;
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
            }
        }))
    };
    return obj;
}


// TODO: Support prototypal inheritance
function dProto() {
    let obj = dObject();

    obj.interface = {
        // TODO: Create setters based on name - IE ":name"
        ';': dInterface(dPrimitive((ctx)=>{
            const def = ctx.stack.pop(); // block 2
            var name = def.blockContent.shift();
            obj.interface[name.stringVal] = def;
            // obj.interface[name.blockContent[0].stringVal] = def;
            // throw "error: unimplemented";
        })),
        'self': dInterface(dPrimitive((ctx => ctx.stack.push(obj))))
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
            if (message.startsWith(startsWith) && (!message.startsWith(startsWithNot) || startsWithNot == "" )) {
                if (!params.hasOwnProperty(message)) {
                    params[message] = ctx.stack.pop();
                }
                // remove the meta field from the block
                block.blockContent.splice(i, 1);
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
                    paramObj.blockContent.push(params[startsWith+paramName])
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
            }
        } else {
            console.error("can not interpret", arg1);
        }
    }));

    obj.interface = {
        ':': dInterface(dPrimitive((ctx)=>{
            ctx.stack.push(colonObject());
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
        var word = "";
        var captured = false;
        while (i < str.length && !captured) {
            if (str[i].trim() == '') {
                if (word.startsWith(`"`)) word += str[i];
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
            else if (str[i].trim() != '') {
                word += str[i];
            }
            i ++;
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

function executeBlock(block, context) {
    let ctx = context;
    const message = block;
    function scopedMessage(message, scopePosition, scopePop) {
        return {
            scopePosition,
            message, 
            scopePop
        };
    }
    // Apply values for @@<identifier>
    applyParams(ctx, message, "@@");
    ctx.messageStack.push(scopedMessage(message, 0, false));
    ctx.messageStackPosition.push(0);
    while (ctx.messageStack.length > 0) {
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
            
            // increase the message position for the current stack by 1
            ctx.messageStackPosition[ctx.messageStackPosition.length - 1] = ctx.messageStackPosition[ctx.messageStackPosition.length - 1] + 1;

            // we've encountered a block (potentially a block of messages and more blocks)
            // that means we get the next object from the value stack and put it in scope
            if (obj.type === types.BLOCK) {
                const nextObj = ctx.stack.pop();
                // put object from the stack onto scope
                ctx.scope.push(nextObj);

                // if nextObj has onBody then we put the stepped onto block on to the value stack 
                if (nextObj.onBody !== null) {
                    // instead of entering the obj for processing messages we process the onBody block for processing blocks
                    ctx.messageStack.push(scopedMessage(nextObj.onBody, ctx.scope.length - 1, true));
                    ctx.messageStackPosition.push(0);
                    ctx.stack.push(obj);
                } 
                // otherwise, we just enter a new scoped message (which is basically entering a block, hence putting on to the message stack and stack position)
                else {
                    ctx.messageStack.push(scopedMessage(obj, ctx.scope.length - 1, true));
                    ctx.messageStackPosition.push(0);
                }
            } 
            // perform primitive
            else if (obj.type === types.PRIMITIVE) { obj.primitive(ctx); } 
            // interpret message
            else if (obj.type === types.MESSAGE) {
                for (var i = scope; i >= 0; i--) {
                    // if the interface responds to the message's value (string val) then we enter 
                    if (ctx.scope[i].interface.hasOwnProperty(obj.stringVal)) {
                        ctx.messageStack.push(scopedMessage(ctx.scope[i].interface[obj.stringVal], i, false));
                        ctx.messageStackPosition.push(0);
                        break;
                    } 
                    // The interface may be able to respond to messages it does not know
                    else if (ctx.scope[i].doesNotUnderstand !== null) {
                        ctx.stack.push(obj);
                        ctx.messageStack.push(scopedMessage(ctx.scope[i].doesNotUnderstand, i, false));
                        ctx.messageStackPosition.push(0);
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
    ] ] ;
    55 factorial
    12 5 : [ @five @@twelve five twelve [ + ] ] [ run/current ]
]
console [ say say ]
`;

var block = stringToBlock(code);
block.extern.run();