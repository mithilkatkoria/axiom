# Bytecode reference

Instruction addresses are indices in the `instructions` array. Opcodes are defined in engine/src/model.rs and mirrored by the display enum in src/language/bytecode.ts. Operands are numeric indices/targets/slots or a function name. All instructions carry a source span and AST node ID. Constants are tagged Values; void is `{ type: "void", value: null }`. This version has no binary bytecode serializer.

Stack notation: left is lower, right is the top. `a b -> r` consumes b, then a. Runtime guards reject stack underflow, mismatched operand types and invalid indices/targets. The compiler accepts only checked programs; direct construction of arbitrary bytecode is not a supported user-facing input format.

| Number | Opcode        | Operand        | Stack effect            | Meaning / error                                              |
| ------ | ------------- | -------------- | ----------------------- | ------------------------------------------------------------ |
| 0      | PUSH_CONST    | constant index | -> value                | Push pool entry; invalid index fails.                        |
| 1      | LOAD_LOCAL    | slot           | -> value                | Read active frame; uninitialized read fails.                 |
| 2      | STORE_LOCAL   | slot           | value ->                | Store in active frame; invalid slot fails.                   |
| 3      | LOAD_GLOBAL   | slot           | -> value                | Read global; uninitialized read fails.                       |
| 4      | STORE_GLOBAL  | slot           | value ->                | Store global; invalid slot fails.                            |
| 5      | ADD           | none           | a b -> a+b              | Finite numbers required.                                     |
| 6      | SUBTRACT      | none           | a b -> a-b              | Finite result required.                                      |
| 7      | MULTIPLY      | none           | a b -> a*b              | Finite result required.                                      |
| 8      | DIVIDE        | none           | a b -> a/b              | Zero divisor and non-finite result fail.                     |
| 9      | MODULO        | none           | a b -> a%b              | Zero divisor fails.                                          |
| 10     | NEGATE        | none           | a -> -a                 | Number required.                                             |
| 11     | NOT           | none           | a -> !a                 | Boolean required.                                            |
| 12     | EQUAL         | none           | a b -> boolean          | Same non-void primitive types required.                      |
| 13     | LESS_THAN     | none           | a b -> a<b              | Numbers required.                                            |
| 14     | LESS_EQUAL    | none           | a b -> a<=b             | Numbers required.                                            |
| 15     | GREATER_THAN  | none           | a b -> a>b              | Numbers required.                                            |
| 16     | GREATER_EQUAL | none           | a b -> a>=b             | Numbers required.                                            |
| 17     | JUMP          | address        | unchanged               | Set PC to valid address.                                     |
| 18     | JUMP_IF_FALSE | address        | boolean ->              | Pop condition; branch when false.                            |
| 19     | CALL          | function name  | args -> (callee work)   | Create frame and jump; unknown callee or depth limit fails.  |
| 20     | RETURN        | none           | result -> caller result | Restore caller PC and stack base; returning from main fails. |
| 21     | PRINT         | none           | primitive -> void       | Capture output; void and output-limit exhaustion fail.       |
| 22     | POP           | none           | value ->                | Discard result.                                              |
| 23     | HALT          | none           | unchanged               | Complete main execution.                                     |
| 24     | DUP           | none           | value -> value value    | Duplicate top tagged primitive.                              |

CALL removes its N arguments, preserves unfinished caller values, and creates a frame with their slots. It does not immediately push a result. RETURN later pushes one result, including void for a no-value function. This paired contract makes a call expression leave exactly one value.

## Actual lowering example

For `print(2 + 3);`, the pool is [number 2, number 3] and instructions are:

```text
0000 PUSH_CONST 0
0001 PUSH_CONST 1
0002 ADD
0003 PRINT
0004 POP
0005 HALT
```

The stack evolves `[] -> [2] -> [2,3] -> [5] -> [void] -> []`. Output becomes `5`. HALT leaves a completed VM. Inspect the Bytecode tab to obtain the actual disassembly for any current program.

## Short circuit and jumps

`a && b` emits a, DUP, JUMP_IF_FALSE(end), POP, b. The jump consumes the duplicate condition; if a is false, the original false remains. Otherwise POP discards true before b produces its result. `a || b` adds NOT on the duplicate before that conditional jump. `!=` is EQUAL followed by NOT.

If/else patches a false jump to the else branch and an unconditional jump to the join. While records a loop head, emits a false exit jump, emits its body and jumps back. There is no simulated loop animation or AST evaluation at runtime.
