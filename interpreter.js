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
        arrayVal: [],
        primitive: (ctx)=>{}, // function that operates on context
        onBody: null, // is a message object . . .
        doesNotUnderstand: null, // is a message object
        messages: {}, // contains message blocks
    };
    return native;
}

function dPrimitive(fn) {
    let obj = dObject();
    obj.type = types.PRIMITIVE;
    obj.primitive = fn;
    return obj;
}

// TODO: add language level interface with this object structure
function dBlock(val) {
    let obj = dObject();
    obj.type = types.BLOCK;
    if (val !== undefined) {
        if (Array.isArray(val)) {
            obj.arrayVal = val;
        } else {
            obj.arrayVal.push(val);
        }
    }
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
    obj.onBody = dBlock(dPrimitive((ctx)=> {
        // same as "ignore this entire message-block"
        ctx.stack.pop();
    }));
    obj.messages = {};
    return obj;
}

function dBoolean(val) {
    let obj = dObject();
    obj.type = types.OBJECT;
    
    if (val) {
        obj.messages["if"] = dBlock(dObject());
        obj.messages["else"] = dBlock(dMute());
    } else {
        obj.messages["if"] = dBlock(dMute());
        obj.messages["else"] = dBlock(dObject());
    }
    // TODO: add boolean logic messages
    return obj;
}

function dNumber(val) {
    let obj = dObject();
    obj.type = types.NUMBER;
    obj.numberVal = val;

    // TODO: complete the operations
    obj.messages = {
        "+": dBlock(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val + (ctx.stack.pop()).numberVal));
        })),
        "-": dBlock(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val - (ctx.stack.pop()).numberVal));
        })),
        "*": dBlock(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val * (ctx.stack.pop()).numberVal));
        })),
        "/": dBlock(dPrimitive((ctx) => {
            ctx.stack.push(dNumber(val / (ctx.stack.pop()).numberVal));
        })),
        
        "1-": dBlock(dPrimitive((ctx) => ctx.stack.push(dNumber(val - 1)) )),

        "<": dBlock(dPrimitive((ctx) => {
            ctx.stack.push(dBoolean(val < (ctx.stack.pop()).numberVal));
        })),
        ">": dBlock(dPrimitive((ctx) => {
            ctx.stack.push(dBoolean(val > (ctx.stack.pop()).numberVal));
        })),
        "=": dBlock(dPrimitive((ctx) => {
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
    
    obj.messages = {

    };
    return obj;
}

function dConsoleObject() {
    let obj = dObject();
    obj.messages = {
        "say": dBlock(dPrimitive((ctx)=>{
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
function dBaseObject() {
    let obj = dObject();

    // TODO: Support enclosing stack objects with special syntax
    function colonObject() {
        let obj = dObject();

        obj.onBody = dBlock(dPrimitive((ctx)=>{
            let wordBlock = ctx.stack.pop();
            let name = wordBlock.arrayVal.shift();
            let nameBlock = dBlock(name);
            ctx.stack.push(nameBlock);
            ctx.stack.push(wordBlock);
        }));

        return obj;
    }
    
    obj.messages = {
        ':': dBlock(dPrimitive((ctx)=>{
            ctx.stack.push(colonObject());
        })),
        // TODO: Create setters based on name - IE ":name"
        ';': dBlock(dPrimitive((ctx)=>{
            const def = ctx.stack.pop(); // block 2
            const name = ctx.stack.pop(); // block 1
            obj.messages[name.arrayVal[0].stringVal] = def;
        })),
        'self': dBlock(dPrimitive((ctx => ctx.stack.push(obj))))
    };

    return obj;
}

function dBase() {
    let obj = dObject();
    obj.type = types.OBJECT;
    
    // push strings or numbers on to the stack. . .
    obj.doesNotUnderstand = dBlock(dPrimitive((ctx)=>{
        var arg1 = ctx.stack.pop();
        if (arg1.type == types.MESSAGE) {
            if (isNumeric(arg1.stringVal)) {
                ctx.stack.push(dNumber(Number.parseFloat(arg1.stringVal)));
            } else if (arg1.stringVal.startsWith('"')) {
                ctx.stack.push(dString(arg1.stringVal.substr(1, arg1.stringVal.length -2)))
            } else {
                console.error("cannot respond to:", arg1);
            }
        } else {
            console.error("can not interpret", arg1);
        }
    }));

    obj.messages = {
        "object": dBlock(dPrimitive((ctx)=>{
            ctx.stack.push(dBaseObject());
        })),
        "console": dBlock(dPrimitive((ctx)=> {
            ctx.stack.push(dConsoleObject());
        })),
        "drop": dBlock(dPrimitive((ctx)=> ctx.stack.pop())),
        "dup": dBlock(dPrimitive((ctx)=>{
            const n = ctx.stack.pop();
            ctx.stack.push(n);
            ctx.stack.push(n);
        })),
        "swap": dBlock(dPrimitive((ctx)=>{
            const valb = ctx.stack.pop();
            const vala = ctx.stack.pop();
            ctx.stack.push(valb);
            ctx.stack.push(vala);
        })),
        "over": dBlock(dPrimitive((ctx)=>{
            const n2 = ctx.stack.pop();
            const n1 = ctx.stack.pop();
            ctx.stack.push(n1);
            ctx.stack.push(n2);
            ctx.stack.push(n1);
        })),
        "rot": dBlock(dPrimitive((ctx)=>{
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

function stringToMessage(str) {
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
                stack[stack.length - 1].arrayVal.push(innerMessage);
                stack.push(innerMessage);
                break;
            case "]":
                stack.pop();
                break;
            default:
                stack[stack.length - 1].arrayVal.push(dMessage(word));
                break;
        }
        word = getNextWord();
    }
    return message;
}

function run(script) {
    let ctx = {
        stack: [], // object stack
        scope: [dBase()],
        messageStack: [],
        messageStackPosition: [],
    };
    const message = stringToMessage(script);
    function scopedMessage(message, scopePosition, scopePop) {
        return {
            scopePosition,
            message, 
            scopePop
        };
    }
    ctx.messageStack.push(scopedMessage(message, 0, false));
    ctx.messageStackPosition.push(0);
    while (ctx.messageStack.length > 0) {
        const scoped = ctx.messageStack[ctx.messageStack.length - 1];
        const block = scoped.message;
        const scope = scoped.scopePosition;
        if (block.arrayVal.length == ctx.messageStackPosition[ctx.messageStackPosition.length - 1]) {
            ctx.messageStack.pop();
            ctx.messageStackPosition.pop();
            if (scoped.scopePop) {
                ctx.scope.pop();
            }
        } else {
            const obj = block.arrayVal[ctx.messageStackPosition[ctx.messageStackPosition.length - 1]]
            ctx.messageStackPosition[ctx.messageStackPosition.length - 1] = ctx.messageStackPosition[ctx.messageStackPosition.length - 1] + 1;

            if (obj.type === types.BLOCK) {
                const nextObj = ctx.stack.pop();
                ctx.scope.push(nextObj);
                // magic!
                if (nextObj.onBody !== null) {
                    ctx.messageStack.push(scopedMessage(nextObj.onBody, ctx.scope.length - 1, true));
                    ctx.messageStackPosition.push(0);
                    ctx.stack.push(obj);
                } else {
                    ctx.messageStack.push(scopedMessage(obj, ctx.scope.length - 1, true));
                    ctx.messageStackPosition.push(0);
                }
            } 
            else if (obj.type === types.PRIMITIVE) {
                obj.primitive(ctx);
            } else if (obj.type === types.MESSAGE) {
                for (var i = scope; i >= 0; i--) {
                    if (ctx.scope[i].messages.hasOwnProperty(obj.stringVal)) {
                        ctx.messageStack.push(scopedMessage(ctx.scope[i].messages[obj.stringVal], i, false));
                        ctx.messageStackPosition.push(0);
                        break;
                    } else if (ctx.scope[i].doesNotUnderstand !== null) {
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
}

run(`
object [
    : [ factorial dup 1 [ < ] [ 
        if [ dup [ 1- ] factorial [ * ] ]
    ] ] ;
    5 factorial
]
console [ say ]
`);