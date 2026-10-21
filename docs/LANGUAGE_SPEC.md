# Axiom language specification, version 1

## Lexical grammar

Identifiers match `[A-Za-z_][A-Za-z0-9_]*`. Keywords are `let fn if else while return true false number string boolean void`. `print` is a reserved built-in identifier. Identifiers are case-sensitive. Whitespace, `//` line comments and non-nested `/* */` comments are ignored. Offsets use UTF-16 code units, as do CodeMirror and JavaScript strings. Lines and columns are one-based; an end offset is exclusive.

Numbers start with a digit, optionally have a fractional part with digits after the dot, and optionally have an exponent. Examples: `1`, `1.25`, `2e3`, `2.5e-2`. `.5`, `1.`, NaN and Infinity are not literals. Negative numbers are unary expressions. Numbers must be finite.

Strings are double-quoted, cannot cross physical lines, and support `\n \r \t \0 \" \\`. Unsupported escapes, unclosed strings/comments and invalid characters produce lexical diagnostics.

## Grammar

```ebnf
program       = { statement } EOF ;
statement     = variable | assignment | block | conditional | loop
              | function | return | expression ";" ;
variable      = "let" identifier ":" type "=" expression ";" ;
assignment    = identifier "=" expression ";" ;
block         = "{" { statement } "}" ;
conditional   = "if" "(" expression ")" block [ "else" (block | conditional) ] ;
loop          = "while" "(" expression ")" block ;
function      = "fn" identifier "(" [ parameters ] ")" ":" type block ;
parameters    = identifier ":" type { "," identifier ":" type } ;
return        = "return" [ expression ] ";" ;
type          = "number" | "string" | "boolean" | "void" ;
expression    = binary-expression ;
primary       = number | string | "true" | "false" | identifier
              | identifier "(" [ arguments ] ")" | "(" expression ")"
              | ("!" | "-") primary ;
arguments     = expression { "," expression } ;
```

Binary precedence, low to high: `||`, `&&`, `== !=`, `< <= > >=`, `+ -`, `* / %`. All binary operators associate left. Unary operators bind above binary operators. Assignment is a statement, not an expression. There is no chained assignment, trailing comma, increment operator or ternary expression. Functions parse as statements but semantic analysis accepts them only at the top level.

## Types and evaluation

`number` uses IEEE 754 double precision. `string` contains UTF-16 text. `boolean` contains true or false. `void` is the result of a no-value function and cannot be a variable/parameter type or a printed operand. No conversion occurs between types.

Arithmetic, negation and ordering require numbers. Equality and inequality require two values of the same non-void type and compare primitive values exactly. `!`, `&&`, `||` and control-flow conditions require booleans. Boolean operators short circuit from left to right. Other binary operations and arguments evaluate left to right. Division/modulo by zero and non-finite arithmetic fail at runtime. Remainder follows JavaScript numeric remainder semantics, including the sign of the left operand. Safe integer precision is limited to 2^53 - 1; negative zero prints as 0.

## Names, storage and functions

`let` requires an initializer and is mutable. Resolve an initializer before adding its own binding, so an inner shadowing initializer can refer to an outer variable. Redeclaration in the same scope is rejected. Nested blocks introduce scopes. Assignments resolve the nearest binding and preserve its type. Variables cannot reuse any function name or print. Each binding receives a distinct slot. Slots are retained until the owning frame ends (or until the main VM is reset).

Top-level signatures are registered first. Calls to later functions and mutual recursion are legal. Parameters pass primitive values into a new frame. Nested functions, closures and function values are excluded. Functions may access bindings in the outermost global scope, including globals declared later in source. An early call that reads an uninitialized global produces R007. Top-level block-local variables are not visible to functions.

An explicit non-void return must match the function result. An if/else returns on every path only when both branches do. A statement sequence returns when at least one statement guarantees return. Loops conservatively never guarantee return. Void functions return a void sentinel when they reach the end. Code after a return is still analyzed. A top-level return is rejected.

`print` accepts exactly one primitive value, captures its string representation as one output entry and returns void. Embedded newline characters stay inside that entry.

## Typing rules (informal formalization)

Let Γ map resolved bindings to types. If Γ(x)=T, then Γ ⊢ x:T. If Γ ⊢ e:T and the declaration says T, then `let x:T=e` extends the current scope with x:T. If Γ ⊢ a:number and Γ ⊢ b:number, then Γ ⊢ a+b:number (similarly for the other arithmetic operations). If Γ ⊢ a:boolean and Γ ⊢ b:boolean, then Γ ⊢ a&&b:boolean. If a function signature is `(T1,...,Tn)->R`, its call requires exactly n expressions of the corresponding types and has type R.

These rules explain the implementation in `src/language/semantic.ts`. Tests establish examples and regressions. No language-wide soundness theorem is claimed.

## Limits and diagnostics

Default limits: 100,000 source characters; 20,000 tokens; 128 syntax/tree levels; 100 compiler diagnostics; 4,096 variable slots per context; 100,000 executed instructions; 128 frames including main; 8,192 operand values; 1,000 output entries and 64,000 output characters; 160 recent trace events. VM limits can be configured through the core createVM/executeProgram options API. The studio uses the defaults.

Diagnostics contain stage, code, severity, message and span. Lexical/syntax/name/type/compile errors prevent VM construction. Runtime and budget faults retain their last observable state. Unexpected implementation failures are tagged internal.
