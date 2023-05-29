
# TODO
- [x] Option&Flag to merge the value stack from top frame to bottom frame after completed execution
- [x] Steal the value stack from context
    - also operations:
        - open the current stack on top of the current stack
        - replace context stack with stack on stack 
- Scope:
    - steal the scope from context
    - ability (operations) to shift and pop from the stolen scope object
    - ability (operation) to stack scopes
- loops
- prototypes for protos
- Arrays implementation (array is an object, that uses block content, that has an interface with special primitives)
- Strings implementation
- Support other string syntax + quote escapes

- onBody should really just be an interface message
- [x] update setters to be an interpretable object instead of a primitive closure
    - On a side note: Attempt to everything serializable by nearly almost dumping the objects to something like "json" (since that's what they currently are represented with)
        - this also means being able to serialize the context and the objects which have primitives
        - [x] Also it probably means closure based primitives need to be rethought? Probably

- Readable Vs Runned blocks (blocks should have two sides, for reflective purposes)
    - This also means absolute values should probably be behind messages instead of fully embedded

- reflection

- connect to browser
- introduce main loop
- Create a repl
- Create and load images
- exceptions / exception handling
- Debugging


- asynchronous callbacks
- module system
- javascript FFI

# Done
- Stack object for the base lang
- block controls

# Bugs
2. If a message is intercepted by something lower in scope then the interface it responds with should, in theory, continue at that level of scope. However, if you decide to, for instance, enter a new block-level message, then that new message will be at the highest level in scope when it should probably be only one level above where it branched from

# Fixed
- If you save the image in the middle of a primitive then the native context frame can't be captured and continued from. So maybe it shouldn't be the responsibility of a primitive, but intercepted as a message to the base object through the interpreter to execute the block.
- params delete instead of nullify (messages should be nullable)
- Execution scope does not properly get carried between block executions