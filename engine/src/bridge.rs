use crate::{build, bytecode, lexer, model::*, parser, semantic, vm::*};
use serde::de::DeserializeOwned;
use serde_json::{Value as Json, json};
use std::cell::{Cell, RefCell};

thread_local! {
    static OUTPUT:RefCell<Vec<u8>>=const {RefCell::new(Vec::new())};
    static SESSION:RefCell<Option<Session>>=const {RefCell::new(None)};
    static NEXT_ID:Cell<u32>=const {Cell::new(0)};
}
fn decode<T: DeserializeOwned>(value: &Json) -> Result<T, String> {
    let text = value.to_string();
    let mut de = serde_json::Deserializer::from_str(&text);
    de.disable_recursion_limit();
    T::deserialize(&mut de).map_err(|e| e.to_string())
}
fn field<T: DeserializeOwned>(request: &Json, name: &str) -> Result<T, String> {
    decode(&request[name])
}
fn next_id() -> u32 {
    NEXT_ID.with(|id| {
        let next = id.get().wrapping_add(1);
        id.set(next);
        next
    })
}
pub fn dispatch(request: Json) -> Result<Json, String> {
    let action = request["action"].as_str().ok_or("Missing engine action.")?;
    let source = request["source"].as_str().unwrap_or("");
    match action {
        "identity" => Ok(json!(crate::engine_identity())),
        "build" => Ok(json!(build(source, next_id()))),
        "tokenize" => Ok(json!(lexer::tokenize(source))),
        "parse" => Ok(json!(parser::parse(&field::<Vec<Token>>(
            &request, "tokens"
        )?))),
        "analyze" => Ok(json!(semantic::analyze(&field(&request, "ast")?))),
        "compile" => Ok(json!(bytecode::compile(
            &field(&request, "ast")?,
            &field(&request, "info")?
        )?)),
        "createVM" => Ok(json!(Vm::new(
            field(&request, "program")?,
            decode(request.get("options").unwrap_or(&json!({})))?
        ))),
        "snapshot" => {
            let vm: Vm = field(&request, "vm")?;
            Ok(json!(vm.state))
        }
        "executeStep" => {
            let mut vm: Vm = field(&request, "vm")?;
            vm.step();
            Ok(json!(vm))
        }
        "debugStep" => {
            let mut vm: Vm = field(&request, "vm")?;
            vm.debug_step(field(&request, "mode")?);
            Ok(json!(vm))
        }
        "stepFinished" => {
            let vm: Vm = field(&request, "vm")?;
            Ok(json!(vm.step_finished(
                field(&request, "mode")?,
                field(&request, "anchor")?
            )))
        }
        "executeProgram" => Ok(json!(
            Vm::new(
                field(&request, "program")?,
                decode(request.get("options").unwrap_or(&json!({})))?
            )
            .execute()
        )),
        "sessionCompile" => {
            let compilation = build(source, next_id());
            let state = SESSION.with(|cell| {
                *cell.borrow_mut() = compilation.program.clone().map(Session::new);
                cell.borrow()
                    .as_ref()
                    .map(|session| session.vm.state.clone())
            });
            Ok(json!({"compilation":compilation,"state":state}))
        }
        "sessionStart" | "sessionTick" | "sessionPause" | "sessionReset" => SESSION.with(|cell| {
            let mut slot = cell.borrow_mut();
            let session = slot
                .as_mut()
                .ok_or("Compile a valid program before executing it.")?;
            match action {
                "sessionStart" => session.start(
                    decode(request.get("mode").unwrap_or(&Json::Null))?,
                    decode(request.get("breakpoints").unwrap_or(&json!([])))?,
                ),
                "sessionTick" => session.tick(),
                "sessionPause" => session.pause(),
                "sessionReset" => session.reset(),
                _ => unreachable!(),
            }
            Ok(json!(session.vm.state))
        }),
        _ => Err(format!("Unknown engine action '{action}'.")),
    }
}
/// Allocate an input buffer. The JavaScript bridge must release the same pointer and length.
#[unsafe(no_mangle)]
pub extern "C" fn axiom_alloc(length: usize) -> *mut u8 {
    Box::into_raw(vec![0_u8; length].into_boxed_slice()) as *mut u8
}
/// Release a buffer allocated by axiom_alloc.
/// # Safety
/// Pointer and length must be the exact still-live allocation returned by axiom_alloc.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn axiom_dealloc(ptr: *mut u8, length: usize) {
    unsafe {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(
            ptr, length,
        )));
    }
}
/// Dispatch a UTF-8 JSON request, returning a borrowed output buffer valid until the next call.
/// # Safety
/// The input must reference length readable bytes allocated by axiom_alloc.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn axiom_dispatch(ptr: *const u8, length: usize) -> *const u8 {
    let result = if length > 32 * 1024 * 1024 {
        Err("Engine transport limit exceeded (32 MiB).".into())
    } else {
        let input = unsafe { std::slice::from_raw_parts(ptr, length) };
        let mut deserializer = serde_json::Deserializer::from_slice(input);
        deserializer.disable_recursion_limit();
        serde::Deserialize::deserialize(&mut deserializer)
            .map_err(|e| e.to_string())
            .and_then(dispatch)
    };
    let response = result.unwrap_or_else(|error| json!({"error":error}));
    OUTPUT.with(|out| {
        *out.borrow_mut() = serde_json::to_vec(&response)
            .unwrap_or_else(|_| b"{\"error\":\"Engine serialization failed.\"}".to_vec());
        out.borrow().as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn axiom_output_len() -> usize {
    OUTPUT.with(|out| out.borrow().len())
}
