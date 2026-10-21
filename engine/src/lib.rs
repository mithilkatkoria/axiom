mod bridge;
pub mod bytecode;
pub mod lexer;
pub mod model;
pub mod parser;
pub mod semantic;
pub mod vm;
use model::*;
use serde::Serialize;

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
unsafe extern "C" {
    fn now() -> f64;
}
pub fn clock() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        unsafe { now() }
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::{sync::OnceLock, time::Instant};
        static START: OnceLock<Instant> = OnceLock::new();
        START.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0
    }
}
#[derive(Serialize)]
pub struct EngineIdentity {
    pub language: &'static str,
    pub runtime: &'static str,
    pub abi: u32,
    pub version: &'static str,
}
pub fn engine_identity() -> EngineIdentity {
    EngineIdentity {
        language: "Rust",
        runtime: if cfg!(target_arch = "wasm32") {
            "WebAssembly"
        } else {
            "native"
        },
        abi: 1,
        version: env!("CARGO_PKG_VERSION"),
    }
}
#[derive(Default, Serialize)]
pub struct Timings {
    pub lex: f64,
    pub parse: f64,
    pub analyze: f64,
    pub compile: f64,
    pub total: f64,
}
#[derive(Serialize)]
pub struct Compilation {
    pub id: u32,
    pub source: String,
    pub tokens: Vec<Token>,
    pub engine: EngineIdentity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ast: Option<Node>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic: Option<SemanticInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub program: Option<Bytecode>,
    pub diagnostics: Vec<Diagnostic>,
    pub timings: Timings,
}
pub fn build(source: &str, id: u32) -> Compilation {
    let start = clock();
    let mut c = Compilation {
        id,
        source: source.into(),
        tokens: vec![],
        engine: engine_identity(),
        ast: None,
        semantic: None,
        program: None,
        diagnostics: vec![],
        timings: Timings::default(),
    };
    pipeline(&mut c);
    c.timings.total = clock() - start;
    c
}
fn pipeline(c: &mut Compilation) {
    let mut start = clock();
    let lexed = lexer::tokenize(&c.source);
    c.tokens = lexed.tokens;
    c.diagnostics = lexed.diagnostics;
    c.timings.lex = clock() - start;
    if !c.diagnostics.is_empty() {
        return;
    }
    start = clock();
    let parsed = parser::parse(&c.tokens);
    c.ast = Some(parsed.ast);
    c.diagnostics = parsed.diagnostics;
    c.timings.parse = clock() - start;
    if !c.diagnostics.is_empty() {
        return;
    }
    let ast = c.ast.as_ref().unwrap();
    let mut pending = vec![(ast, 0)];
    while let Some((node, depth)) = pending.pop() {
        if depth > 128 {
            c.diagnostics.push(diagnostic(
                "compile",
                "C001",
                "Syntax tree depth exceeds 128. Split this expression into smaller statements.",
                node.span,
            ));
            return;
        }
        for child in node.children() {
            pending.push((child, depth + 1));
        }
    }
    start = clock();
    let info = semantic::analyze(ast);
    c.diagnostics = info.diagnostics.clone();
    c.semantic = Some(info);
    c.timings.analyze = clock() - start;
    if !c.diagnostics.is_empty() {
        return;
    }
    start = clock();
    match bytecode::compile(ast, c.semantic.as_ref().unwrap()) {
        Ok(program) => c.program = Some(program),
        Err(error) => c
            .diagnostics
            .push(diagnostic("internal", "I001", error, Span::origin())),
    }
    c.timings.compile = clock() - start;
}
#[cfg(test)]
mod tests;
