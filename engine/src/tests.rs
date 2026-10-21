use crate::{
    build, lexer,
    model::{op::*, *},
    vm::*,
};
fn run(source: &str) -> Snapshot {
    let c = build(source, 1);
    assert!(c.diagnostics.is_empty(), "{:?}", c.diagnostics);
    Vm::new(c.program.expect("valid bytecode"), Options::default()).execute()
}
#[test]
fn recursion_uses_independent_frames() {
    let state = run(
        "fn factorial(n:number):number{if(n<=1){return 1;}return n*factorial(n-1);}print(factorial(5));",
    );
    assert_eq!(state.output, ["120"]);
    assert_eq!(state.status, Status::Completed);
    assert!(state.max_depth >= 6);
    assert!(state.stack.is_empty());
}
#[test]
fn forward_mutual_recursion_is_resolved() {
    assert_eq!(run("print(even(6));fn odd(n:number):boolean{if(n==0){return false;}return even(n-1);}fn even(n:number):boolean{if(n==0){return true;}return odd(n-1);}").output,["true"]);
}
#[test]
fn precedence_short_circuit_and_remainder_match_language() {
    assert_eq!(
        run("print(2+3*4);print((2+3)*4);print(-10%3);print(false&&(1/0>0));print(true||(1/0>0));")
            .output,
        ["14", "20", "-1", "false", "true"]
    );
}
#[test]
fn lexical_scopes_keep_values_separate() {
    assert_eq!(run("let x:number=10;{let x:number=20;print(x);}print(x);fn f(n:number):number{let x:number=n;{let x:number=9;print(x);}x=x+1;return x;}print(f(2));").output,["20","10","9","3"]);
}
#[test]
fn primitive_output_preserves_javascript_numeric_format() {
    assert_eq!(
        run("print(-0);print(1e21);print(1e-7);print(0.1+0.2);print(\"hello\");print(true);")
            .output,
        ["0", "1e+21", "1e-7", "0.30000000000000004", "hello", "true"]
    );
}
#[test]
fn unicode_spans_are_utf16_offsets() {
    let source = "print(\"🦀\");\nprint(42);";
    let lexed = lexer::tokenize(source);
    assert!(lexed.diagnostics.is_empty());
    let n = lexed.tokens.iter().find(|t| t.lexeme == "42").unwrap();
    assert_eq!(n.span.line, 2);
    assert_eq!(n.span.column, 7);
    assert_eq!(n.span.start, source.find("42").unwrap() - 2);
    assert_eq!(run(source).output, ["🦀", "42"]);
}
#[test]
fn malformed_input_and_type_errors_do_not_emit_bytecode() {
    for (source, stage) in [
        ("\"unterminated", "lexical"),
        ("/* comment", "lexical"),
        ("print(2+);", "syntax"),
        ("let x:number=\"text\";", "type"),
        ("print(missing);", "name"),
        ("return 2;", "type"),
        ("fn f():number{}", "type"),
        ("fn f(a:void):void{}", "type"),
        ("fn print():void{}", "name"),
        ("print(false&&3);", "type"),
        ("fn f():void{fn g():void{}}", "type"),
        ("let x:number=1;let x:number=2;", "name"),
    ] {
        let c = build(source, 1);
        assert!(c.program.is_none(), "{source}");
        assert!(
            c.diagnostics.iter().any(|d| d.stage == stage),
            "{source}: {:?}",
            c.diagnostics
        );
    }
}
#[test]
fn source_and_tree_limits_are_preserved() {
    assert_eq!(build(&" ".repeat(100001), 1).diagnostics[0].code, "L000");
    assert_eq!(
        build(&format!("print({});", vec!["1"; 200].join("+")), 1).diagnostics[0].code,
        "C001"
    );
    let deep = format!("print({}1{});", "(".repeat(140), ")".repeat(140));
    assert_eq!(build(&deep, 1).diagnostics[0].stage, "syntax");
}
#[test]
fn arithmetic_faults_keep_the_faulting_instruction() {
    for source in ["print(1/0);", "print(1%0);", "print(1e308*1e308);"] {
        let c = build(source, 1);
        let p = c.program.unwrap();
        let state = Vm::new(p.clone(), Options::default()).execute();
        assert_eq!(state.status, Status::Errored);
        assert_eq!(state.diagnostic.as_ref().unwrap().stage, "runtime");
        assert_eq!(
            state.diagnostic.unwrap().span,
            p.instructions[state.pc].span
        );
    }
}
#[test]
fn all_resource_budgets_are_effective() {
    for (source, options, code) in [
        (
            "while(true){}",
            Options {
                instruction_budget: 10,
                ..Options::default()
            },
            "B001",
        ),
        (
            "fn f():void{f();}f();",
            Options {
                call_depth: 8,
                ..Options::default()
            },
            "B002",
        ),
        (
            "print(1+2);",
            Options {
                stack_limit: 1,
                ..Options::default()
            },
            "B003",
        ),
        (
            "while(true){print(1);}",
            Options {
                output_limit: 3,
                ..Options::default()
            },
            "B004",
        ),
        (
            "print(\"🦀\");",
            Options {
                output_characters: 1,
                ..Options::default()
            },
            "B004",
        ),
    ] {
        let state = Vm::new(build(source, 1).program.unwrap(), options).execute();
        assert_eq!(state.diagnostic.unwrap().code, code, "{source}");
    }
}
#[test]
fn uninitialized_globals_fault_at_load() {
    assert_eq!(
        run("f();let x:number=1;fn f():void{print(x);}")
            .diagnostic
            .unwrap()
            .code,
        "R007"
    );
}
#[test]
fn bytecode_has_valid_jump_targets_and_all_source_maps() {
    let c = build("let i:number=0;while(i<3){if(i==1){print(i);}i=i+1;}", 1);
    let p = c.program.unwrap();
    for ins in &p.instructions {
        assert!(ins.span.end <= c.source.encode_utf16().count());
        if ins.op == JUMP || ins.op == JUMP_IF_FALSE {
            let Some(Operand::Slot(target)) = ins.operand else {
                panic!("missing jump");
            };
            assert!((0..p.instructions.len() as i64).contains(&target));
        }
    }
}
#[test]
fn instruction_step_and_out_keep_real_arguments() {
    let p = build("fn f(n:number):number{\nreturn n+1;\n}\nprint(f(4));", 1)
        .program
        .unwrap();
    let mut vm = Vm::new(p, Options::default());
    vm.debug_step(StepMode::Instruction);
    assert_eq!(vm.state.pc, 1);
    vm.debug_step(StepMode::Instruction);
    assert_eq!(vm.state.frames.len(), 2);
    assert_eq!(vm.state.frames[1].locals[0], Some(Value::Number(4.0)));
    vm.debug_step(StepMode::Out);
    assert_eq!(vm.state.frames.len(), 1);
    assert_eq!(vm.state.stack[0], Value::Number(5.0));
}
#[test]
fn session_breakpoints_pause_and_continue() {
    let p = build("let x:number=1;\nprint(x);\nprint(2);", 1)
        .program
        .unwrap();
    let mut session = Session::new(p);
    session.start(None, vec![2]);
    session.tick();
    assert_eq!(session.vm.state.status, Status::Paused);
    assert!(session.vm.state.output.is_empty());
    assert_eq!(session.vm.line(), Some(2));
    session.start(None, vec![2]);
    session.tick();
    assert_eq!(session.vm.state.status, Status::Completed);
    assert_eq!(session.vm.state.output, ["1", "2"]);
    session.reset();
    assert_eq!(session.vm.state.steps, 0);
    assert_eq!(session.vm.state.status, Status::Ready);
}
#[test]
fn session_yields_and_pause_preserves_state() {
    let p = build("while(true){}", 1).program.unwrap();
    let mut session = Session::new(p);
    session.start(None, vec![]);
    session.tick();
    assert_eq!(session.vm.state.steps, 1500);
    session.pause();
    let pc = session.vm.state.pc;
    session.tick();
    assert_eq!(session.vm.state.pc, pc);
    assert_eq!(session.vm.state.status, Status::Paused);
}
#[test]
fn terminated_vm_does_not_execute() {
    let mut vm = Vm::new(build("print(1);", 1).program.unwrap(), Options::default());
    vm.state.status = Status::Terminated;
    vm.step();
    assert_eq!(vm.state.pc, 0);
    assert!(vm.state.output.is_empty());
}
#[test]
fn snapshots_are_owned_and_trace_is_bounded() {
    let state = run("let i:number=0;while(i<100){i=i+1;}");
    let mut copy = state.clone();
    copy.globals.clear();
    assert_eq!(state.globals[0], Some(Value::Number(100.0)));
    assert_eq!(state.trace.len(), 160);
}
#[test]
fn native_bridge_preserves_compile_and_vm_contracts() {
    let value =
        crate::bridge::dispatch(serde_json::json!({"action":"build","source":"print(42);"}))
            .unwrap();
    let state = crate::bridge::dispatch(
        serde_json::json!({"action":"executeProgram","program":value["program"]}),
    )
    .unwrap();
    assert_eq!(state["output"], serde_json::json!(["42"]));
    assert_eq!(state["status"], "completed");
}
