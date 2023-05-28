
# TODO
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
- onBody should really just be an interface message

- update setters to be an interpretable object instead of a primitive closure
    - On a side note: Attempt to everything serializable by nearly almost dumping the objects to something like "json" (since that's what they currently are represented with)
        - this also means being able to serialize the context and the objects which have primitives
        - Also it probably means closure based primitives need to be rethought? Probably

- reflection

- connect to browser
- introduce main loop
- Create a repl
- Create and load images
- exceptions / exception handling


- asynchronous callbacks
- module system
- javascript FFI

# Done
- Stack object for the base lang
- block controls

# Bugs

# Fixed
- params delete instead of nullify (messages should be nullable)
- Execution scope does not properly get carried between block executions