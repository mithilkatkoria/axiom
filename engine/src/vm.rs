use crate::{
    clock,
    model::{op::*, *},
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Ready,
    Running,
    Paused,
    Completed,
    Errored,
    Terminated,
}
impl Status {
    pub fn finished(self) -> bool {
        matches!(self, Self::Completed | Self::Errored | Self::Terminated)
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Options {
    pub instruction_budget: usize,
    pub call_depth: usize,
    pub stack_limit: usize,
    pub output_limit: usize,
    pub output_characters: usize,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            instruction_budget: 100_000,
            call_depth: 128,
            stack_limit: 8192,
            output_limit: 1000,
            output_characters: 64_000,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub name: String,
    pub return_pc: i64,
    pub stack_base: usize,
    pub locals: Vec<Option<Value>>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Trace {
    pub step: usize,
    pub pc: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opcode: Option<String>,
    pub line: usize,
    pub depth: usize,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub pc: usize,
    pub stack: Vec<Value>,
    pub globals: Vec<Option<Value>>,
    pub frames: Vec<Frame>,
    pub output: Vec<String>,
    pub status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<Diagnostic>,
    pub steps: usize,
    pub max_stack: usize,
    pub max_depth: usize,
    pub trace: Vec<Trace>,
    pub elapsed_ms: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vm {
    pub program: Bytecode,
    pub options: Options,
    pub output_size: usize,
    #[serde(flatten)]
    pub state: Snapshot,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StepMode {
    Instruction,
    Into,
    Over,
    Out,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Anchor {
    pub pc: usize,
    pub line: usize,
    pub depth: usize,
}
struct Fault {
    code: &'static str,
    message: String,
    budget: bool,
}
type Result<T> = std::result::Result<T, Fault>;
fn fault(code: &'static str, message: impl Into<String>) -> Fault {
    Fault {
        code,
        message: message.into(),
        budget: false,
    }
}
fn budget(code: &'static str, message: impl Into<String>) -> Fault {
    Fault {
        code,
        message: message.into(),
        budget: true,
    }
}
fn number(value: Value) -> Result<f64> {
    if let Value::Number(v) = value {
        Ok(v)
    } else {
        Err(fault("R002", "Expected a number on the operand stack."))
    }
}
fn boolean(value: Value) -> Result<bool> {
    if let Value::Boolean(v) = value {
        Ok(v)
    } else {
        Err(fault("R003", "Expected a boolean on the operand stack."))
    }
}
fn comma_number(n: usize) -> String {
    let digits = n.to_string();
    let mut text = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            text.push(',');
        }
        text.push(c);
    }
    text
}
impl Vm {
    pub fn new(program: Bytecode, options: Options) -> Self {
        Self {
            program,
            options,
            output_size: 0,
            state: Snapshot {
                pc: 0,
                stack: vec![],
                globals: vec![],
                frames: vec![Frame {
                    name: "<main>".into(),
                    return_pc: -1,
                    stack_base: 0,
                    locals: vec![],
                }],
                output: vec![],
                status: Status::Ready,
                diagnostic: None,
                steps: 0,
                max_stack: 0,
                max_depth: 1,
                trace: vec![],
                elapsed_ms: 0.0,
            },
        }
    }
    pub fn anchor(&self) -> Anchor {
        Anchor {
            pc: self.state.pc,
            line: self.line().unwrap_or(1),
            depth: self.state.frames.len(),
        }
    }
    pub fn line(&self) -> Option<usize> {
        self.program
            .instructions
            .get(self.state.pc)
            .map(|i| i.span.line)
    }
    fn pop(&mut self) -> Result<Value> {
        self.state
            .stack
            .pop()
            .ok_or_else(|| fault("R001", "Operand stack underflow."))
    }
    fn push(&mut self, value: Value) -> Result<()> {
        if self.state.stack.len() >= self.options.stack_limit {
            return Err(budget("B003", "Operand stack limit reached."));
        }
        self.state.stack.push(value);
        Ok(())
    }
    fn jump(&mut self, operand: Option<&Operand>) -> Result<()> {
        if let Some(Operand::Slot(n)) = operand
            && *n >= 0
            && (*n as usize) < self.program.instructions.len()
        {
            self.state.pc = *n as usize;
            return Ok(());
        }
        Err(fault("R004", "Invalid jump target."))
    }
    pub fn step(&mut self) {
        if self.state.status.finished() {
            return;
        }
        let pc = self.state.pc;
        let ins = self.program.instructions.get(pc).cloned();
        let result = self.instruction(ins.as_ref());
        if let Err(error) = result {
            self.state.status = Status::Errored;
            self.state.pc = pc;
            self.state.diagnostic = Some(diagnostic(
                if error.budget { "budget" } else { "runtime" },
                error.code,
                error.message,
                ins.map_or(Span::origin(), |i| i.span),
            ));
        } else {
            self.state.max_stack = self.state.max_stack.max(self.state.stack.len());
            self.state.max_depth = self.state.max_depth.max(self.state.frames.len());
        }
    }
    fn instruction(&mut self, ins: Option<&Instruction>) -> Result<()> {
        if self.state.steps >= self.options.instruction_budget {
            return Err(budget(
                "B001",
                format!(
                    "Instruction budget exhausted ({} instructions). Check for an infinite loop.",
                    comma_number(self.options.instruction_budget)
                ),
            ));
        }
        let ins =
            ins.ok_or_else(|| fault("R005", "Instruction pointer is outside the program."))?;
        if self.state.status == Status::Ready {
            self.state.status = Status::Paused;
        }
        self.state.trace.push(Trace {
            step: self.state.steps + 1,
            pc: self.state.pc,
            opcode: NAMES.get(ins.op as usize).map(|name| name.to_string()),
            line: ins.span.line,
            depth: self.state.frames.len(),
        });
        if self.state.trace.len() > 160 {
            self.state.trace.remove(0);
        }
        self.state.pc += 1;
        self.state.steps += 1;
        let slot = match ins.operand {
            Some(Operand::Slot(n)) if n >= 0 => Some(n as usize),
            _ => None,
        };
        match ins.op {
            PUSH_CONST => {
                let v = slot
                    .and_then(|n| self.program.constants.get(n))
                    .cloned()
                    .ok_or_else(|| fault("R006", "Invalid constant index."))?;
                self.push(v)?;
            }
            LOAD_LOCAL | LOAD_GLOBAL => {
                let values = if ins.op == LOAD_LOCAL {
                    &self
                        .state
                        .frames
                        .last()
                        .ok_or_else(|| {
                            fault("R007", "Variable used before its initializer executed.")
                        })?
                        .locals
                } else {
                    &self.state.globals
                };
                let value = slot
                    .and_then(|n| values.get(n))
                    .and_then(Clone::clone)
                    .ok_or_else(|| {
                        fault("R007", "Variable used before its initializer executed.")
                    })?;
                self.push(value)?;
            }
            STORE_LOCAL | STORE_GLOBAL => {
                let slot = slot
                    .filter(|n| *n < 4096)
                    .ok_or_else(|| fault("R008", "Invalid variable slot."))?;
                let value = self.pop()?;
                let values = if ins.op == STORE_LOCAL {
                    &mut self
                        .state
                        .frames
                        .last_mut()
                        .ok_or_else(|| fault("R008", "Invalid variable slot."))?
                        .locals
                } else {
                    &mut self.state.globals
                };
                if values.len() <= slot {
                    values.resize(slot + 1, None);
                }
                values[slot] = Some(value);
            }
            ADD | SUBTRACT | MULTIPLY | DIVIDE | MODULO | LESS_THAN | LESS_EQUAL | GREATER_THAN
            | GREATER_EQUAL => {
                let right = number(self.pop()?)?;
                let left = number(self.pop()?)?;
                if (ins.op == DIVIDE || ins.op == MODULO) && right == 0.0 {
                    return Err(fault("R009", "Division or modulo by zero."));
                }
                let value = match ins.op {
                    ADD => Value::Number(left + right),
                    SUBTRACT => Value::Number(left - right),
                    MULTIPLY => Value::Number(left * right),
                    DIVIDE => Value::Number(left / right),
                    MODULO => Value::Number(left % right),
                    LESS_THAN => Value::Boolean(left < right),
                    LESS_EQUAL => Value::Boolean(left <= right),
                    GREATER_THAN => Value::Boolean(left > right),
                    _ => Value::Boolean(left >= right),
                };
                if let Value::Number(n) = value
                    && !n.is_finite()
                {
                    return Err(fault("R010", "Arithmetic produced a non-finite number."));
                }
                self.push(value)?;
            }
            NEGATE => {
                let n = number(self.pop()?)?;
                self.push(Value::Number(-n))?;
            }
            NOT => {
                let b = boolean(self.pop()?)?;
                self.push(Value::Boolean(!b))?;
            }
            EQUAL => {
                let r = self.pop()?;
                let l = self.pop()?;
                let compatible = matches!(
                    (&l, &r),
                    (Value::Number(_), Value::Number(_))
                        | (Value::String(_), Value::String(_))
                        | (Value::Boolean(_), Value::Boolean(_))
                );
                if !compatible {
                    return Err(fault(
                        "R011",
                        "Equality requires compatible primitive values.",
                    ));
                }
                self.push(Value::Boolean(l == r))?;
            }
            JUMP => self.jump(ins.operand.as_ref())?,
            JUMP_IF_FALSE => {
                if !boolean(self.pop()?)? {
                    self.jump(ins.operand.as_ref())?;
                }
            }
            DUP => {
                let value = self.pop()?;
                self.push(value.clone())?;
                self.push(value)?;
            }
            POP => {
                self.pop()?;
            }
            CALL => {
                let function = if let Some(Operand::Name(name)) = &ins.operand {
                    self.program.functions.get(name).cloned()
                } else {
                    None
                };
                let function =
                    function.ok_or_else(|| fault("R012", "Unknown function in bytecode."))?;
                if self.state.frames.len() >= self.options.call_depth {
                    return Err(budget(
                        "B002",
                        format!(
                            "Call depth limit reached ({} frames).",
                            self.options.call_depth
                        ),
                    ));
                }
                let mut args = vec![];
                for _ in &function.params {
                    args.push(self.pop()?);
                }
                args.reverse();
                if function.locals > 4096 || function.params.iter().any(|p| *p >= 4096) {
                    return Err(fault("R008", "Invalid variable slot."));
                }
                let mut locals = vec![None; function.locals];
                for (slot, value) in function.params.iter().zip(args) {
                    if locals.len() <= *slot {
                        locals.resize(slot + 1, None);
                    }
                    locals[*slot] = Some(value);
                }
                self.state.frames.push(Frame {
                    name: function.name,
                    return_pc: self.state.pc as i64,
                    stack_base: self.state.stack.len(),
                    locals,
                });
                self.jump(Some(&Operand::Slot(function.entry as i64)))?;
            }
            RETURN => {
                if self.state.frames.len() <= 1 {
                    return Err(fault("R013", "Cannot return from the main program."));
                }
                let value = self.pop()?;
                let completed = self.state.frames.pop().unwrap();
                self.state.stack.truncate(completed.stack_base);
                self.state.pc = completed.return_pc.max(0) as usize;
                self.push(value)?;
            }
            PRINT => {
                let value = self.pop()?;
                let text = value
                    .text()
                    .ok_or_else(|| fault("R014", "Cannot print void."))?;
                let length = text.encode_utf16().count();
                if self.state.output.len() >= self.options.output_limit
                    || self.output_size + length > self.options.output_characters
                {
                    return Err(budget(
                        "B004",
                        "Output limit reached. Reduce the number or length of printed values.",
                    ));
                }
                self.state.output.push(text);
                self.output_size += length;
                self.push(Value::Void(()))?;
            }
            HALT => self.state.status = Status::Completed,
            _ => return Err(fault("R015", "Unknown opcode.")),
        }
        Ok(())
    }
    pub fn step_finished(&self, mode: StepMode, anchor: Anchor) -> bool {
        if matches!(self.state.status, Status::Completed | Status::Errored) {
            return true;
        }
        match mode {
            StepMode::Instruction => true,
            StepMode::Out => self.state.frames.len() < anchor.depth,
            StepMode::Into | StepMode::Over => {
                let different =
                    self.line() != Some(anchor.line) || self.state.frames.len() != anchor.depth;
                different
                    && (matches!(mode, StepMode::Into) || self.state.frames.len() <= anchor.depth)
            }
        }
    }
    pub fn debug_step(&mut self, mode: StepMode) {
        let anchor = self.anchor();
        loop {
            self.step();
            if self.step_finished(mode, anchor) || self.state.status.finished() {
                break;
            }
        }
        if matches!(self.state.status, Status::Ready | Status::Running) {
            self.state.status = Status::Paused;
        }
    }
    pub fn execute(mut self) -> Snapshot {
        let start = clock();
        self.state.status = Status::Running;
        while self.state.status == Status::Running {
            self.step();
        }
        self.state.elapsed_ms = clock() - start;
        self.state
    }
}
pub struct Session {
    pub vm: Vm,
    mode: Option<StepMode>,
    anchor: Anchor,
    breakpoints: Vec<usize>,
    skip_line: Option<usize>,
}
impl Session {
    pub fn new(program: Bytecode) -> Self {
        let vm = Vm::new(program, Options::default());
        let anchor = vm.anchor();
        Self {
            vm,
            mode: None,
            anchor,
            breakpoints: vec![],
            skip_line: None,
        }
    }
    pub fn start(&mut self, mode: Option<StepMode>, breakpoints: Vec<usize>) {
        if self.vm.state.status.finished() {
            return;
        }
        self.anchor = self.vm.anchor();
        self.skip_line = if self.vm.state.status == Status::Ready {
            None
        } else {
            Some(self.anchor.line)
        };
        self.mode = mode;
        self.breakpoints = breakpoints;
        self.vm.state.status = Status::Running;
    }
    pub fn tick(&mut self) {
        let begin = clock();
        for _ in 0..1500 {
            if self.vm.state.status != Status::Running {
                break;
            }
            let line = self.vm.line();
            if line != self.skip_line {
                self.skip_line = None;
            }
            if self.mode.is_none()
                && line.is_some_and(|n| self.breakpoints.contains(&n))
                && line != self.skip_line
            {
                self.vm.state.status = Status::Paused;
                break;
            }
            self.vm.step();
            if self
                .mode
                .is_some_and(|mode| self.vm.step_finished(mode, self.anchor))
            {
                if self.vm.state.status == Status::Running {
                    self.vm.state.status = Status::Paused;
                }
                break;
            }
        }
        self.vm.state.elapsed_ms += clock() - begin;
    }
    pub fn pause(&mut self) {
        if self.vm.state.status == Status::Running {
            self.vm.state.status = Status::Paused;
        }
    }
    pub fn reset(&mut self) {
        self.vm = Vm::new(self.vm.program.clone(), Options::default());
    }
}
