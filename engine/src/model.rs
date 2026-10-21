use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub line: usize,
    pub column: usize,
}
impl Span {
    pub fn origin() -> Self {
        Self {
            start: 0,
            end: 0,
            line: 1,
            column: 1,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub code: String,
    pub stage: String,
    pub severity: String,
    pub message: String,
    pub span: Span,
}
pub fn diagnostic(stage: &str, code: &str, message: impl Into<String>, span: Span) -> Diagnostic {
    Diagnostic {
        code: code.into(),
        stage: stage.into(),
        severity: "error".into(),
        message: message.into(),
        span,
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Type {
    Number,
    String,
    Boolean,
    Void,
}
impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Number => "number",
            Self::String => "string",
            Self::Boolean => "boolean",
            Self::Void => "void",
        })
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Primitive {
    Number(f64),
    String(String),
    Boolean(bool),
}
impl Primitive {
    pub fn ty(&self) -> Type {
        match self {
            Self::Number(_) => Type::Number,
            Self::String(_) => Type::String,
            Self::Boolean(_) => Type::Boolean,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Token {
    #[serde(flatten)]
    pub span: Span,
    pub kind: String,
    pub lexeme: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub literal: Option<Primitive>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Node {
    pub id: u32,
    pub span: Span,
    #[serde(flatten)]
    pub data: NodeKind,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all_fields = "camelCase")]
pub enum NodeKind {
    Program {
        body: Vec<Node>,
    },
    Block {
        body: Vec<Node>,
    },
    Function {
        name: String,
        params: Vec<Node>,
        return_type: Type,
        body: Box<Node>,
    },
    Parameter {
        name: String,
        #[serde(rename = "type")]
        ty: Type,
    },
    Variable {
        name: String,
        #[serde(rename = "type")]
        ty: Type,
        value: Box<Node>,
    },
    Assignment {
        name: String,
        value: Box<Node>,
    },
    If {
        condition: Box<Node>,
        then: Box<Node>,
        #[serde(skip_serializing_if = "Option::is_none")]
        otherwise: Option<Box<Node>>,
    },
    While {
        condition: Box<Node>,
        body: Box<Node>,
    },
    Return {
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<Box<Node>>,
    },
    Expression {
        value: Box<Node>,
    },
    Literal {
        value: Primitive,
    },
    Identifier {
        name: String,
    },
    Unary {
        operator: String,
        operand: Box<Node>,
    },
    Binary {
        operator: String,
        left: Box<Node>,
        right: Box<Node>,
    },
    Call {
        name: String,
        args: Vec<Node>,
    },
}
impl Node {
    pub fn children(&self) -> Vec<&Node> {
        match &self.data {
            NodeKind::Program { body } | NodeKind::Block { body } => body.iter().collect(),
            NodeKind::Function { params, body, .. } => params
                .iter()
                .chain(std::iter::once(body.as_ref()))
                .collect(),
            NodeKind::Variable { value, .. }
            | NodeKind::Assignment { value, .. }
            | NodeKind::Expression { value } => vec![value],
            NodeKind::If {
                condition,
                then,
                otherwise,
            } => {
                let mut nodes = vec![condition.as_ref(), then.as_ref()];
                if let Some(other) = otherwise {
                    nodes.push(other);
                }
                nodes
            }
            NodeKind::While { condition, body } => vec![condition, body],
            NodeKind::Return { value } => value.iter().map(Box::as_ref).collect(),
            NodeKind::Unary { operand, .. } => vec![operand],
            NodeKind::Binary { left, right, .. } => vec![left, right],
            NodeKind::Call { args, .. } => args.iter().collect(),
            _ => vec![],
        }
    }
    pub fn body(&self) -> &[Node] {
        match &self.data {
            NodeKind::Program { body } | NodeKind::Block { body } => body,
            _ => &[],
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub id: usize,
    pub name: String,
    #[serde(rename = "type")]
    pub ty: Type,
    pub slot: usize,
    pub global: bool,
    pub scope: usize,
    pub owner: String,
    pub span: Span,
    pub scope_span: Span,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Signature {
    pub name: String,
    pub params: Vec<Type>,
    pub result: Type,
    pub node: Node,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SemanticInfo {
    pub bindings: Vec<Binding>,
    pub references: BTreeMap<u32, usize>,
    pub types: BTreeMap<u32, Type>,
    pub functions: BTreeMap<String, Signature>,
    pub diagnostics: Vec<Diagnostic>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "lowercase")]
pub enum Value {
    Number(f64),
    String(String),
    Boolean(bool),
    Void(()),
}
impl From<&Primitive> for Value {
    fn from(value: &Primitive) -> Self {
        match value {
            Primitive::Number(v) => Self::Number(*v),
            Primitive::String(v) => Self::String(v.clone()),
            Primitive::Boolean(v) => Self::Boolean(*v),
        }
    }
}
impl Value {
    pub fn text(&self) -> Option<String> {
        match self {
            Self::Number(v) => Some(ryu_js::Buffer::new().format(*v).into()),
            Self::String(v) => Some(v.clone()),
            Self::Boolean(v) => Some(v.to_string()),
            Self::Void(_) => None,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Operand {
    Slot(i64),
    Name(String),
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instruction {
    pub op: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand: Option<Operand>,
    pub span: Span,
    pub node_id: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompiledFunction {
    pub name: String,
    pub entry: usize,
    pub params: Vec<usize>,
    pub locals: usize,
    pub return_type: Type,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Bytecode {
    pub instructions: Vec<Instruction>,
    pub constants: Vec<Value>,
    pub functions: BTreeMap<String, CompiledFunction>,
    pub bindings: Vec<Binding>,
}
pub mod op {
    pub const PUSH_CONST: u32 = 0;
    pub const LOAD_LOCAL: u32 = 1;
    pub const STORE_LOCAL: u32 = 2;
    pub const LOAD_GLOBAL: u32 = 3;
    pub const STORE_GLOBAL: u32 = 4;
    pub const ADD: u32 = 5;
    pub const SUBTRACT: u32 = 6;
    pub const MULTIPLY: u32 = 7;
    pub const DIVIDE: u32 = 8;
    pub const MODULO: u32 = 9;
    pub const NEGATE: u32 = 10;
    pub const NOT: u32 = 11;
    pub const EQUAL: u32 = 12;
    pub const LESS_THAN: u32 = 13;
    pub const LESS_EQUAL: u32 = 14;
    pub const GREATER_THAN: u32 = 15;
    pub const GREATER_EQUAL: u32 = 16;
    pub const JUMP: u32 = 17;
    pub const JUMP_IF_FALSE: u32 = 18;
    pub const CALL: u32 = 19;
    pub const RETURN: u32 = 20;
    pub const PRINT: u32 = 21;
    pub const POP: u32 = 22;
    pub const HALT: u32 = 23;
    pub const DUP: u32 = 24;
    pub const NAMES: [&str; 25] = [
        "PUSH_CONST",
        "LOAD_LOCAL",
        "STORE_LOCAL",
        "LOAD_GLOBAL",
        "STORE_GLOBAL",
        "ADD",
        "SUBTRACT",
        "MULTIPLY",
        "DIVIDE",
        "MODULO",
        "NEGATE",
        "NOT",
        "EQUAL",
        "LESS_THAN",
        "LESS_EQUAL",
        "GREATER_THAN",
        "GREATER_EQUAL",
        "JUMP",
        "JUMP_IF_FALSE",
        "CALL",
        "RETURN",
        "PRINT",
        "POP",
        "HALT",
        "DUP",
    ];
}
