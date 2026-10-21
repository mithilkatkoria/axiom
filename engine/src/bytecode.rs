use crate::model::{op::*, *};
pub fn compile(ast: &Node, info: &SemanticInfo) -> Result<Bytecode, String> {
    if !info.diagnostics.is_empty() {
        return Err("Cannot compile a program with semantic diagnostics.".into());
    }
    let mut compiler = Compiler {
        info,
        program: Bytecode {
            bindings: info.bindings.clone(),
            ..Bytecode::default()
        },
    };
    for node in ast.body() {
        compiler.stmt(node)?;
    }
    compiler.emit(HALT, ast, None);
    for node in ast.body() {
        if let NodeKind::Function {
            name,
            params,
            return_type,
            body,
        } = &node.data
        {
            let locals = info
                .bindings
                .iter()
                .filter(|b| !b.global && b.owner == *name)
                .count();
            let slots = params
                .iter()
                .map(|n| compiler.binding(n).map(|b| b.slot))
                .collect::<Result<Vec<_>, _>>()?;
            compiler.program.functions.insert(
                name.clone(),
                CompiledFunction {
                    name: name.clone(),
                    entry: compiler.program.instructions.len(),
                    params: slots,
                    locals,
                    return_type: *return_type,
                },
            );
            compiler.stmt(body)?;
            compiler.constant(Value::Void(()), node);
            compiler.emit(RETURN, node, None);
        }
    }
    Ok(compiler.program)
}
struct Compiler<'a> {
    info: &'a SemanticInfo,
    program: Bytecode,
}
impl Compiler<'_> {
    fn emit(&mut self, op: u32, node: &Node, operand: Option<Operand>) -> usize {
        let i = self.program.instructions.len();
        self.program.instructions.push(Instruction {
            op,
            operand,
            span: node.span,
            node_id: node.id,
        });
        i
    }
    fn patch(&mut self, index: usize) {
        self.program.instructions[index].operand =
            Some(Operand::Slot(self.program.instructions.len() as i64));
    }
    fn constant(&mut self, value: Value, node: &Node) {
        let slot = self
            .program
            .constants
            .iter()
            .position(|c| *c == value)
            .unwrap_or_else(|| {
                self.program.constants.push(value);
                self.program.constants.len() - 1
            });
        self.emit(PUSH_CONST, node, Some(Operand::Slot(slot as i64)));
    }
    fn binding(&self, node: &Node) -> Result<&Binding, String> {
        self.info
            .references
            .get(&node.id)
            .and_then(|id| self.info.bindings.get(*id))
            .ok_or_else(|| "Missing semantic binding.".into())
    }
    fn expr(&mut self, node: &Node) -> Result<(), String> {
        match &node.data {
            NodeKind::Literal { value } => self.constant(Value::from(value), node),
            NodeKind::Identifier { .. } => {
                let b = self.binding(node)?;
                let (op, slot) = (if b.global { LOAD_GLOBAL } else { LOAD_LOCAL }, b.slot);
                self.emit(op, node, Some(Operand::Slot(slot as i64)));
            }
            NodeKind::Unary { operator, operand } => {
                self.expr(operand)?;
                self.emit(if operator == "!" { NOT } else { NEGATE }, node, None);
            }
            NodeKind::Binary {
                operator,
                left,
                right,
            } => {
                self.expr(left)?;
                if operator == "&&" || operator == "||" {
                    self.emit(DUP, node, None);
                    if operator == "||" {
                        self.emit(NOT, node, None);
                    }
                    let jump = self.emit(JUMP_IF_FALSE, node, Some(Operand::Slot(0)));
                    self.emit(POP, node, None);
                    self.expr(right)?;
                    self.patch(jump);
                } else {
                    self.expr(right)?;
                    let op = match operator.as_str() {
                        "+" => ADD,
                        "-" => SUBTRACT,
                        "*" => MULTIPLY,
                        "/" => DIVIDE,
                        "%" => MODULO,
                        "==" | "!=" => EQUAL,
                        "<" => LESS_THAN,
                        "<=" => LESS_EQUAL,
                        ">" => GREATER_THAN,
                        ">=" => GREATER_EQUAL,
                        _ => return Err("Unknown binary operator.".into()),
                    };
                    self.emit(op, node, None);
                    if operator == "!=" {
                        self.emit(NOT, node, None);
                    }
                }
            }
            NodeKind::Call { name, args } => {
                for arg in args {
                    self.expr(arg)?;
                }
                self.emit(
                    if name == "print" { PRINT } else { CALL },
                    node,
                    if name == "print" {
                        None
                    } else {
                        Some(Operand::Name(name.clone()))
                    },
                );
            }
            _ => return Err("Expected an expression in bytecode compiler.".into()),
        }
        Ok(())
    }
    fn stmt(&mut self, node: &Node) -> Result<(), String> {
        match &node.data {
            NodeKind::Block { body } => {
                for statement in body {
                    self.stmt(statement)?;
                }
            }
            NodeKind::Function { .. } => {}
            NodeKind::Variable { value, .. } | NodeKind::Assignment { value, .. } => {
                self.expr(value)?;
                let b = self.binding(node)?;
                let (op, slot) = (if b.global { STORE_GLOBAL } else { STORE_LOCAL }, b.slot);
                self.emit(op, node, Some(Operand::Slot(slot as i64)));
            }
            NodeKind::Expression { value } => {
                self.expr(value)?;
                self.emit(POP, node, None);
            }
            NodeKind::If {
                condition,
                then,
                otherwise,
            } => {
                self.expr(condition)?;
                let jump = self.emit(JUMP_IF_FALSE, node, Some(Operand::Slot(0)));
                self.stmt(then)?;
                if let Some(other) = otherwise {
                    let end = self.emit(JUMP, node, Some(Operand::Slot(0)));
                    self.patch(jump);
                    self.stmt(other)?;
                    self.patch(end);
                } else {
                    self.patch(jump);
                }
            }
            NodeKind::While { condition, body } => {
                let start = self.program.instructions.len();
                self.expr(condition)?;
                let exit = self.emit(JUMP_IF_FALSE, node, Some(Operand::Slot(0)));
                self.stmt(body)?;
                self.emit(JUMP, node, Some(Operand::Slot(start as i64)));
                self.patch(exit);
            }
            NodeKind::Return { value } => {
                if let Some(value) = value {
                    self.expr(value)?;
                } else {
                    self.constant(Value::Void(()), node);
                }
                self.emit(RETURN, node, None);
            }
            _ => return Err("Expected a statement in bytecode compiler.".into()),
        }
        Ok(())
    }
}
