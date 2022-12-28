# Drone
Back talk.

## A simple question
Drone is a general purpose programming language. It is stack oriented, message oriented, and language oriented. 
It was initially designed based on the question "what would happen if we merged message oriented programming with stack oriented programming"? 
Or, more simply, "What if Forth was message oriented?". What came out of that question is Drone. The intention behind
asking and addressing the question was hopefully to come up with a language that is both simple in practice,
and simple in theory. This comes from the idea that Forth is considerably "simple in practice" and that 
something like smalltalk is "simple in theory" - meaning smalltalk takes the idea of one concept, objects,
and applies it all the way down. 

Languages that inspired/influenced Drone include but are not limited to Forth/Factor, Smalltalk/Self, and Rebol/Red.

## Drone: 1 answer to the question
For *this specific* iteration of combining the above ideas, currently called Drone, we find a few interesting properties.

1. At its core: Simple syntax, simple semantics, simple implementation
2. Good for designing DSLs
3. Code, data, and behavior are unified 

## How it works

### Part 1: Everything is an object
Much like Self/Smalltalk everything is an object. Objects basically behave the way you'd imagine they do in a
prototypal language like Self - there are no classes. Objects in Drone are essentially nameless structures
that can be interacted with through their exposed interface and prototype hierarchy. The interface of a Drone object is never private - however encapsulation of data/behavior can still be achieved through a technique *similar* to how closures work in JavaScript.

When it is said that everything is an object though, everything *is* just an object and they all communicate with each other through
messaging (if we can call it that). If implemented correctly, it will be objects and messaging all the way down - so interpretation 
and compilation will all work through the same core mechanics/ideas/framework all the way to the interpreter itself. When coming up
with the language one of the core ideas was to design something as if objects were "talking-with/interacting-with" the 
interpreter/compiler itself. The language was supposed to be "interacting with itself" all the way down. This will make more sense in part 2 and 3.

### Part 2: Stack and "Scope" - Context
**Context:** In drone there are two core features to the language framework: Stack and Scope. "You don't say!" - yes because it's basically
the core of Drone, and you interact semi-indirectly with the stack and the scope through messaging. 
What's the deal? This is *presently* theoertical, but the hope is to implement this in some circular way where you message/interface
with an object called context. The context is basically circular in such that it is an object that maintains the stack and the
scope (which are objects which also communicate through stack and scope) *and* starts the flow of the program by being the base of the
scope to begin with - meaning all programs start off by "talking" to context - which talks to itself and its members circularly.

**Stack:** The stack is how data (objects) moves around. Basically, something gets put on the stack, something gets taken off the stack, or something
mutates the order of the stack through the above. The stack is at the core of the language - thus this is a *stack oriented* language
in such that the stack is how any meaningful side effects ocur. 

**Scope:** First and foremost - the scope of this language *is*, primarily, dynamic, unlike most languages which happen to be lexically scoped. 
This can be an issue for some, if not most developers who have become used to lexically scoped languages. 
It is difficult to argue for why a dynamic scope was chosen, but one reason it came down to dynamic scope was as a result of one of many initial design
goals that were aimed at attempting to make the implementation as "simple as possible" while also keeping the language as simple as possible. And, yes,
the language achieves semantic & syntactic level simplicity while also mainting implementation-level simplicity through having a dynamic scope.

But how is the scope designed anyways? Basically the scope is essentially another stack of objects. However, interfacing with the scope stack is implicit
instead of explicit like the actual data stack. This stack of objects, the scope, is a top down structure. You send messages on the scope and it falls down
the scope chain until someone ultimately responds (with more messages downwards), or someone consumes the message entirely (ignores it). 

That being said, the scope is all about messages, which we'll discuss next.


### Part 3: Words (and objects), bodies, Messaging
Messaging is relatively simple compared to part 2. Messaging is essentially just having a word be applied to the objects in the scope tree, one
by one, until an object knows how to respond to it. Messages are effectively nothing more than a string, but what more does a message _need_ to
be? That's how it works. A message just needs to be something that can be reacted to by the objects - since they don't do more than reveal behavior
by responding to said messages.

In Drone "messages" are "words" found inside of blocks. Words are effectively strings, which are objects, but they're all unique and 
immutable. Messages are *like* strings, but strings are not messages. Blocks may contain actual objects as well, but objects don't implement the
specialized interface and get sent straight to the stack when stepped on during block processing. One special thing to note, as well, is that
since this langauge attempts to be language-oriented friendly there exists a way to bind a word to an object - thus it gets treated like an object
when applied to the scope, but it may be parsed like a word when when captured (making it more friendly for the object attempting to introduce a
DSL). 

# Syntax and Semantics

**Informal Syntax:**

```
Message :: <character(s)-without-space> | "<characters-including-space>"
Block   :: [ Message ] | [ Body ]
```

The syntax is simple. A message is any body of characters that isn't a single open or closing bracket.
It may be odd, but messages can have spaces in them if they're surrounded in quotes. 

Dumb example of Drone code:

```Drone
"Hello" console [ "world" print print ]
```

**Informal semantics:** 
1. When a message is read it gets "sent" to the scope. 
2. An object on the scope recieves a message and responds by sending more messages, or nothing, back to the scope from its current position in the scope. 
    - This trend happens all the way down until a message mutates the stack (which is a primitive action and doesn't expand like other messages). 
3. When the start of a block is read, it will put the object from the top of the stack on to the top of the scope 
    - Thus a block may be thought of as a message that mutates the stack and the scope.
    - Messages in the block are applied in the usual fashion. 
4. Note: Blocks and messages are objects too, so they can be put on the stack as well. 
5. A block is put on the stack, instead of being implicitly applied to the scope, if the object at the top of the data-stack responds to a message to intercept blocks. 
6. A message, itself, is put on the data-stack (as an object) if an object in scope intercepts it with "doesNotUnderstand".


# Problems to address / Future

The following are a few things that are still being considered / thought about. They either add a lot of complexity or break certain "purity" rules if not
done right.

- Exceptions / Error handling mechanics 
- Live coding / Live image
- Bootstrapping for live coding
- Reflection
- Specialized messaging semantics
- Typing / Type-Checking
- Comment syntax and semantics (why is this hard?)
- Live IDE
    - DSL Syntax Higlighting Integration


# Informal Details/Property of the language
- Homoiconic (Should be at least)
- Messages + Scope + Stack
- There are no variables
- No lexical scope
- All structures are anonymous (no typing)
- Drone files (while there are files) end with `.hum`

# Examples

## Factorial 
5 factorial iterative
```drone
5 dup dup loop [
    dup 1 [ >= ] [ if [ [1-] dup rot [*] swap ] ]
] drop
```

5 factorial recursive
```drone
: [ factorial dup 1 [ > ] [ if [ [ 1- ] factorial [ * ] ] ] ] ;
5 factorial
```

