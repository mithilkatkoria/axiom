# Interview preparation

These questions refer to this implementation. Reproduce each answer by reading the referenced module and running a small program. Do not present tested examples as formal proofs or agent-produced work as exclusively human-authored.

1. **Why introduce a lexer instead of parsing characters directly?** `lexer.ts` gives the parser meaningful units and precise locations. It centralizes comments, number formats and escapes so grammar routines do not repeat those rules.

2. **What is the difference between a token's lexeme and literal?** The lexeme is the original source slice. The literal is its decoded primitive, so the spelling of a string escape differs from its resulting character.

3. **How are error locations preserved?** Tokens track UTF-16 offsets and one-based line/column positions. AST nodes and emitted instructions carry spans, allowing every inspector and diagnostic to navigate the editor.

4. **How are two-character operators recognized?** The lexer checks pairs such as <= and && before single-character operators. Reversing that order would split one valid operator into unrelated tokens.

5. **What happens to comments?** Line and non-nested block comments are consumed without tokens. An unterminated block comment still receives a lexical diagnostic and location.

6. **Why use recursive descent?** Each statement form has a clear grammar and dedicated branch in parser.ts. This small language benefits from a transparent algorithm that a student can trace without a generator toolchain.

7. **How does operator precedence work?** expression(min) parses higher-precedence right operands recursively. Multiplication therefore becomes a child of addition in `2+3*4`.

8. **Why parse the right operand at precedence plus one?** It prevents another same-precedence operator from joining the right operand. This makes `10-3-2` associate as `(10-3)-2`.

9. **What information is absent from the AST?** Punctuation, comments and grouping parentheses do not become independent nodes. The AST retains the structure those parentheses established and the spans needed to find source.

10. **Why use discriminated unions?** model.ts makes each kind's fields explicit, letting TypeScript narrow inside compiler passes. A new node forces updates to traversal, checking and lowering instead of silently accepting arbitrary object shapes.

11. **Are node IDs persistent across edits?** They are stable only within one parse. Compilation versions identify sessions, so a node with the same number in another compilation is not assumed to be the same node.

12. **What is a symbol table?** In semantic.ts, a Scope contains a Map from names to Binding records. Each record retains type, owner, lexical scope, slot and source metadata.

13. **How does shadowing avoid overwriting the outer variable?** Lookup finds the nearest scope, while every declaration gets a distinct storage slot. The inner and outer variables can share a name while holding independent values.

14. **Why check an initializer before declaring its name?** It prevents an uninitialized self-reference from resolving to the declaration being created. In a nested scope, an initializer may intentionally read an existing outer binding of the same name.

15. **How are later functions callable?** Top-level signatures are registered before expressions and bodies are analyzed. The compiler records function entries before runtime CALL resolves the name, so source declaration order need not match call order.

16. **What makes mutual recursion possible?** Both signatures exist during semantic analysis, and both entries exist before the VM begins. Their bodies can therefore refer to each other without host-language recursion.

17. **What is statically checked about a function call?** The analyzer verifies the callee exists, the argument count matches and each expression has the corresponding parameter type. The call expression receives the declared result type.

18. **How does return-path analysis work?** A return guarantees return; a sequence guarantees return when a statement does; an if/else requires both branches. Loops conservatively do not establish a guaranteed return, even when a human can see one.

19. **What can static typing not guarantee here?** It does not prove a divisor is nonzero, a loop terminates or a global has been initialized before an early function call. Runtime guards cover those cases.

20. **Why not transpile to JavaScript?** Axiom's bytecode and explicit machine make stack, frames and control flow directly inspectable. Host eval would obscure those semantics and expose capabilities the language deliberately lacks.

21. **What is the constant pool for?** bytecode.ts interns tagged primitive constants and uses numeric PUSH_CONST operands. Repeated constants can share entries while instruction data remains compact and inspectable.

22. **Is the bytecode a binary file format?** No. It is an executable structured representation with numeric opcodes and typed metadata. A serializer and verifier would be a separate extension with compatibility and validation requirements.

23. **How are if and while compiled?** If emits conditional and optional unconditional jumps with patched targets. While records a head address, emits a conditional exit, then a backward jump after the body.

24. **How does short circuit preserve stack balance?** DUP keeps a result candidate while JUMP_IF_FALSE consumes a condition copy. If the right side is needed, POP removes the original candidate before compiling that side.

25. **Why does PRINT push void?** Every expression leaves one result. PRINT captures its primitive operand and leaves a void sentinel, which an expression statement then removes with POP.

26. **What distinguishes the operand stack from the call stack?** The operand stack holds intermediate expression values. The call stack stores frame context, including local slots, return addresses and the operand height to restore.

27. **What occurs during CALL?** The VM pops arguments in reverse stack order, restores their declared order into parameter slots, records the caller PC and stack height, and jumps to the callee entry.

28. **What occurs during RETURN?** The result is popped, the callee frame removed, the operand stack restored to its saved base, and the caller PC restored. The result is then pushed as the call expression's value.

29. **Why does ordinary recursion work?** Each call creates a fresh locals array, so every n is independent. The explicit operand stack preserves pending multiplications while deeper factorial frames compute results.

30. **Why bound call depth if recursion is explicit?** Explicit frames still allocate memory and retain values. The default limit of 128 frames includes main and produces a structured budget diagnostic before unbounded growth.

31. **How does a runtime failure differ from a compile error?** Compile-stage diagnostics prevent program creation. Runtime faults happen while valid bytecode executes, preserving output and the fault location in an errored VM snapshot.

32. **What prevents an infinite loop freezing the page?** The studio runs compilation/execution in a worker, yields between bounded chunks, and imposes an instruction budget. Stop additionally terminates the worker rather than only changing button state.

33. **Does a worker itself limit memory?** No. The VM separately bounds instructions, frames, operands and output. Source/token/tree limits protect compilation, and trace storage keeps only a recent window.

34. **How do pause and stop differ?** Pause preserves the worker VM for continuation. Stop terminates the worker and invalidates its version; reset creates a fresh worker/session before execution can continue.

35. **How does stepping know where to stop?** stepFinished compares source lines and frame depth against an anchor. Instruction mode stops after one opcode; over ignores deeper frames; out stops at a shallower depth.

36. **What is the source-step limitation?** Multiple statements on one physical line share a source step. Precise statement boundary metadata would be needed for finer granularity, and reverse execution would require retained/restorable state.

37. **How are stale inspector results prevented?** hooks.ts terminates old workers and increments the request version on edits. Replies from older versions are ignored and previous compiler/runtime state is cleared.

38. **Why copy snapshots?** The UI should observe state without owning or mutating the running machine. snapshot copies frames, primitive values and arrays, which also introduces a real transport/copying cost worth measuring.

39. **How is the AST picture connected to real code?** AstExplorer traverses the parser's nodes using children(). Selecting a node sends its exact span to CodeMirror; it does not identify nodes by matching displayed text.

40. **How do you support non-visual AST exploration?** The Tree tab uses expandable HTML rows and keyboard-operable buttons. Children render on expansion; the graph has a 300-node bound while the tree exposes the full structure.

41. **What is parsing complexity?** Lexing and ordinary parsing traverse input approximately linearly for this grammar. Deep recursion is bounded. The full implementation has other costs: repeated constant-pool searches and linear trace shifting are not constant-time claims about the entire pipeline.

42. **Why not reuse local slots when a block ends?** Distinct slots simplify lexical shadowing and inspection. Reuse would require liveness/scope metadata and tests to avoid displaying stale or aliased variables.

43. **How would closures change the design?** Functions would need captured environments that outlive an ordinary call frame. Binding resolution, value types, storage lifetime, garbage collection and CALL semantics would all change.

44. **How are benchmarks made credible?** Inputs and expected outputs are explicit; warm-up/sample counts are documented; timing ranges and environment metadata are exported. The default Fibonacci inputs are not matched, so no direct speed comparison is claimed.

45. **Which evidence supports completion, and what remains uncertain?** Reproduce typecheck, lint, engine tests, browser tests and production build, then inspect recorded screenshots. These do not replace a proof, broad fuzzing, cross-browser testing or screen-reader evaluation, and known limits belong in the report.
