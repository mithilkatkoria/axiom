# Learning guide: building a machine you can understand

This guide is for a motivated Year 12 Computer Science student. Begin by running `npm ci`, `npm test` and `npm run dev` from the Axiom directory. Keep the studio open beside the source. Do not try to learn every module in one sitting. Work through one transformation and verify it with a tiny program.

## 1. Why a lexer exists

A computer receives characters, but `123` is more useful as one number than as three unrelated digits. A lexer groups characters into tokens. Look at `engine/src/lexer.rs`, especially tokenize's character loop, take, the identifier branch and the numeric branch. It tracks offsets and line/column positions so later errors can point to the original source.

In the studio, enter `let x: number = 12;` and open Tokens. Compare each lexeme with its location. Change 12 to 12.5. The token count stays the same while the number token's literal value changes. The lexeme is spelling; the literal is meaning. Strings make the distinction especially clear: a source `\n` escape decodes to one newline character.

**Exercise:** Add a test that a CRLF newline still puts the next token at line 2, column 1. Then add and test a new supported string escape. Decide what invalid escapes should do before editing the lexer.

## 2. Parsing establishes structure

Tokens alone do not tell us whether multiplication happens before addition. The parser builds an AST: an abstract syntax tree. In `engine/src/parser.rs`, statement chooses a statement form, block collects statements, primary reads atomic expressions and expression handles binary precedence.

For `2 + 3 * 4`, the root operation is addition; its right child is multiplication. The expression routine recursively parses an operator's right operand with a minimum precedence of the current level plus one. Higher precedence enters that operand. An operator at the same precedence stays outside, producing left associativity. Trace `10 - 3 - 2` on paper and check the AST.

**Exercise:** Write tests for `20 / 2 * 3` and `20 / (2 * 3)`. Explain why their trees differ. Add a parser-only test that inspects node kinds and operators instead of relying only on execution output.

## 3. An AST is a model, not a picture

Read Node and NodeKind in `engine/src/model.rs`. Rust enum variants have an identity, span and typed fields. TypeScript display contracts mirror this wire format. A Binary contains left and right expressions; an If contains a condition and branches. Comments and punctuation do not become nodes. Grouping parentheses change structure without creating an extra node.

`children(node)` exposes structure for inspectors and the depth checker. `src/studio/AstExplorer.tsx` lays that structure out, but it does not define semantics. The graph is therefore replaceable without changing execution.

**Exercise:** Select a Binary node in the studio. Record its source offsets and compare the selected characters. Explain why a selected expression can map to several bytecode instructions.

## 4. Symbol tables answer “which variable?”

A symbol table maps a name to a declaration. One dictionary is insufficient when inner scopes can shadow outer names. `engine/src/semantic.rs` keeps a stack of Scope objects, each with a Map. resolve searches backward. declare rejects duplicate names in the current scope, allocates a unique binding and associates AST nodes with its binding ID.

Try `let x:number=10; { let x:number=20; print(x); } print(x);`. There are two x bindings, two slots and two outputs. In an inner declaration initializer, `let x:number=x+1;` can read the outer x because the initializer is checked before the new name is inserted.

**Exercise:** Test shadowing, same-scope redeclaration, an out-of-scope read and assignment to an outer variable. Draw the scope stack at each declaration.

## 5. Static typing constrains possible operations

The analyzer's expr routine computes types recursively and records them by AST node ID. A numeric Literal has type number. Looking up an Identifier gives its binding type. Addition requires both operands to be number and returns number. A condition requires boolean. check constructs a source-located diagnostic for a mismatch.

Read LANGUAGE_SPEC.md's typing rules, then find their branches in expr. A function signature supplies expected argument and return types. Registering signatures before checking bodies allows mutual recursion.

Static checks do not guarantee every program succeeds. `1 / 0` is well-typed but fails dynamically. An infinite loop may also be well-typed. Tests demonstrate properties for selected programs; they are not a mathematical proof of soundness.

**Exercise:** Write one test each for wrong argument count, wrong argument type, a missing return branch and a wrong return type. Explain why treating all nonempty strings as true would contradict this language's rules.

## 6. Compilation replaces structure with a plan

Read the op module in model.rs and compile in `engine/src/bytecode.rs`. A tree says what an expression is; bytecode says what to do in order. For `print(2+3);`, the plan pushes 2, pushes 3, adds, prints, pops the void result and halts. Look up every stack effect in BYTECODE.md.

Conditionals initially emit a jump with a temporary target. After the branch is compiled, the compiler knows where the target belongs and patches it. While emits a jump back to the condition. Short circuit keeps a single boolean on the stack and skips the right expression when its value is unnecessary.

**Exercise:** Disassemble a two-branch if. Label the condition, true branch, false branch and join address. Then inspect `false && (1/0>0)` and identify the jump that prevents division.

## 7. A stack machine executes one instruction

In `engine/src/vm.rs`, Vm::new constructs explicit state and Vm::step mutates it. TypeScript createVM and executeStep delegate to Rust. PC is the next instruction address. A tagged Value contains its type and primitive value. pop detects underflow. Numeric and boolean guards detect invalid operands. A runtime failure records a diagnostic and an errored state rather than throwing through the UI.

Step `print(2+3);` one instruction at a time. Write the stack contents after each instruction. Notice that PRINT pushes void so every expression leaves exactly one result; the expression statement's POP then restores balance.

**Exercise:** Add a test that a loop containing calls ends with an empty operand stack. Deliberately remove POP in a private experiment, observe the stack growth, then restore the implementation.

## 8. Functions require independent call frames

A function call must remember where to return and keep its locals separate from its caller's. Frame stores name, returnPc, stackBase and locals. CALL pops arguments into slots and jumps to a function entry. RETURN restores the saved stack base and PC, then pushes the result.

In factorial, each call stores a different n. The caller's multiplication waits while a deeper frame computes its operand. This is why the operand stack and call stack are different structures. Inspect both in Runtime. The maximum call-depth limit includes the main frame.

**Exercise:** Trace factorial(3) by hand, including each return address and pending multiplication. Test a two-argument function to verify argument order, and a nested call such as add(add(1,2),3).

## 9. A debugger controls, then observes

Vm::debug_step and Vm::step_finished in vm.rs implement core stepping. The worker uses the same stopping rules while yielding between chunks. snapshot copies PC, stacks, frames, values, output and recent trace events. The debugger observes this data; animation does not decide what ran.

Instruction stepping performs one opcode. Source stepping compares lines and call depth. Step over skips deeper frames, and step out waits for a shallower frame. This implementation has no reverse execution. Several statements on one line share a source step.

**Exercise:** Add an automated assertion that stepping into a recursive call creates a new frame with the correct n. Add a source breakpoint using F9, continue and confirm the highlighted instruction belongs to that source line.

## 10. Responsiveness and stale data are correctness concerns

An infinite loop on the browser main thread freezes editing. `src/workers/execution.worker.ts` runs the VM elsewhere and yields every 1,500 instructions. Resource limits stop unbounded work. `src/studio/hooks.ts` terminates workers on stop, source changes and cleanup. Version numbers reject old responses.

Change source while paused and observe that the old runtime disappears. That is a correctness feature: output from one program must not look like output from another. Compile limits, VM limits and worker termination protect different stages.

**Exercise:** Write a browser test that edits during a paused session and proves old frames and output disappear. Compare stopping a worker with merely disabling a button. Explain why a worker alone does not limit output memory.

## 11. Measure rather than guess

`src/benchmarks.ts` defines seven validated inputs. `src/workers/benchmark.worker.ts` performs two warm-ups and ten samples, reports medians and range, and records instruction/stack/frame counts. `tests/benchmark.test.ts` offers a repeatable Node experiment. Browser and Node timings are different environments and should be labeled separately.

**Exercise:** Change both Fibonacci inputs to the same n, export repeated measurements, and graph instructions against n using an external plotting tool. Separate the hypothesis, method, observations and limitations. Do not infer universal compiler performance from one device.

## Reading order

engine/src/model.rs -> lexer.rs -> parser.rs -> semantic.rs -> bytecode.rs -> vm.rs -> lib.rs -> bridge.rs -> src/language/runtime.ts -> execution.worker.ts -> hooks.ts -> Editor.tsx -> Inspector.tsx -> AstExplorer.tsx -> tests. Run the relevant tests after each experiment. Explain a change in your own words before adding it to a portfolio.
