use crate::model::*;
use std::collections::BTreeMap;
#[derive(Clone)]
struct Scope {
    id: usize,
    symbols: BTreeMap<String, Binding>,
    span: Span,
}
struct Analyzer {
    info: SemanticInfo,
    scopes: Vec<Scope>,
    scope_id: usize,
    global_slot: usize,
    local_slot: usize,
    owner: String,
    expected_return: Option<Type>,
}
pub fn analyze(ast: &Node) -> SemanticInfo {
    let global = Scope {
        id: 0,
        symbols: BTreeMap::new(),
        span: ast.span,
    };
    let mut analyzer = Analyzer {
        info: SemanticInfo::default(),
        scopes: vec![global],
        scope_id: 1,
        global_slot: 0,
        local_slot: 0,
        owner: "<main>".into(),
        expected_return: None,
    };
    for node in ast.body() {
        if let NodeKind::Function {
            name,
            params,
            return_type,
            ..
        } = &node.data
        {
            if analyzer.info.functions.contains_key(name) || name == "print" {
                analyzer.error(
                    "name",
                    "N005",
                    format!("Function '{name}' is already defined or reserved."),
                    node,
                );
            } else {
                let params = params
                    .iter()
                    .map(|p| match &p.data {
                        NodeKind::Parameter { ty, .. } => *ty,
                        _ => Type::Void,
                    })
                    .collect();
                analyzer.info.functions.insert(
                    name.clone(),
                    Signature {
                        name: name.clone(),
                        params,
                        result: *return_type,
                        node: node.clone(),
                    },
                );
            }
        }
    }
    for node in ast.body() {
        if !matches!(node.data, NodeKind::Function { .. }) {
            analyzer.statement(node);
        }
    }
    let global = analyzer.scopes[0].clone();
    for node in ast.body() {
        if let NodeKind::Function {
            name,
            params,
            return_type,
            body,
        } = &node.data
        {
            analyzer.owner = name.clone();
            analyzer.local_slot = 0;
            analyzer.expected_return = Some(*return_type);
            let scope = analyzer.scope(body.span);
            analyzer.scopes = vec![global.clone(), scope];
            for parameter in params {
                if let NodeKind::Parameter { name, ty } = &parameter.data {
                    analyzer.declare(parameter, name, *ty);
                }
            }
            let returns = analyzer.statements(body.body());
            if *return_type != Type::Void && !returns {
                analyzer.error(
                    "type",
                    "T010",
                    format!("Function '{name}' must return '{return_type}' on every path."),
                    node,
                );
            }
        }
    }
    analyzer.info
}
impl Analyzer {
    fn error(&mut self, stage: &str, code: &str, message: impl Into<String>, node: &Node) {
        if self.info.diagnostics.len() < 100 {
            self.info
                .diagnostics
                .push(diagnostic(stage, code, message, node.span));
        }
    }
    fn check(&mut self, actual: Type, expected: Type, node: &Node) {
        if actual != expected {
            self.error(
                "type",
                "T001",
                format!("Expected '{expected}', received '{actual}'."),
                node,
            );
        }
    }
    fn scope(&mut self, span: Span) -> Scope {
        let id = self.scope_id;
        self.scope_id += 1;
        Scope {
            id,
            symbols: BTreeMap::new(),
            span,
        }
    }
    fn declare(&mut self, node: &Node, name: &str, ty: Type) {
        if self.scopes.last().unwrap().symbols.contains_key(name) {
            self.error(
                "name",
                "N002",
                format!("'{name}' is already declared in this scope."),
                node,
            );
        }
        if name == "print" || self.info.functions.contains_key(name) {
            self.error(
                "name",
                "N003",
                format!("'{name}' is reserved for a function."),
                node,
            );
        }
        if ty == Type::Void {
            self.error(
                "type",
                "T002",
                "Variables and parameters cannot have type void.",
                node,
            );
        }
        let global = self.owner == "<main>";
        let slot = if global {
            let s = self.global_slot;
            self.global_slot += 1;
            s
        } else {
            let s = self.local_slot;
            self.local_slot += 1;
            s
        };
        let scope = self.scopes.last().unwrap();
        let binding = Binding {
            id: self.info.bindings.len(),
            name: name.into(),
            ty,
            slot,
            global,
            scope: scope.id,
            owner: self.owner.clone(),
            span: node.span,
            scope_span: scope.span,
        };
        if slot >= 4096 {
            self.error(
                "type",
                "T003",
                "Variable limit exceeded (4,096 slots per context).",
                node,
            );
        }
        self.info.references.insert(node.id, binding.id);
        self.scopes
            .last_mut()
            .unwrap()
            .symbols
            .insert(name.into(), binding.clone());
        self.info.bindings.push(binding);
    }
    fn resolve(&mut self, node: &Node, name: &str) -> Option<Binding> {
        for scope in self.scopes.iter().rev() {
            if let Some(binding) = scope.symbols.get(name) {
                let b = binding.clone();
                self.info.references.insert(node.id, b.id);
                return Some(b);
            }
        }
        self.error(
            "name",
            "N001",
            format!("Unknown variable '{name}'. Declare it before use."),
            node,
        );
        None
    }
    fn expr(&mut self, node: &Node) -> Type {
        let ty = match &node.data {
            NodeKind::Literal { value } => value.ty(),
            NodeKind::Identifier { name } => self.resolve(node, name).map_or(Type::Void, |b| b.ty),
            NodeKind::Unary { operator, operand } => {
                let actual = self.expr(operand);
                let expected = if operator == "!" {
                    Type::Boolean
                } else {
                    Type::Number
                };
                self.check(actual, expected, operand);
                expected
            }
            NodeKind::Binary {
                operator,
                left,
                right,
            } => {
                let l = self.expr(left);
                let r = self.expr(right);
                if operator == "&&" || operator == "||" {
                    self.check(l, Type::Boolean, left);
                    self.check(r, Type::Boolean, right);
                    Type::Boolean
                } else if operator == "==" || operator == "!=" {
                    if l == Type::Void || l != r {
                        self.error(
                            "type",
                            "T004",
                            "Equality requires two values of the same primitive type.",
                            node,
                        );
                    }
                    Type::Boolean
                } else {
                    self.check(l, Type::Number, left);
                    self.check(r, Type::Number, right);
                    if ["<", "<=", ">", ">="].contains(&operator.as_str()) {
                        Type::Boolean
                    } else {
                        Type::Number
                    }
                }
            }
            NodeKind::Call { name, args } => {
                let types: Vec<Type> = args.iter().map(|arg| self.expr(arg)).collect();
                if name == "print" {
                    if types.len() != 1 {
                        self.error(
                            "type",
                            "T005",
                            "print expects exactly one primitive argument.",
                            node,
                        );
                    }
                    if types.contains(&Type::Void) {
                        self.error("type", "T006", "Cannot print a void value.", node);
                    }
                    Type::Void
                } else if let Some(signature) = self.info.functions.get(name).cloned() {
                    if types.len() != signature.params.len() {
                        self.error(
                            "type",
                            "T007",
                            format!(
                                "'{name}' expects {} arguments, received {}.",
                                signature.params.len(),
                                types.len()
                            ),
                            node,
                        );
                    }
                    for (i, actual) in types.iter().enumerate() {
                        if let Some(expected) = signature.params.get(i) {
                            self.check(*actual, *expected, &args[i]);
                        }
                    }
                    signature.result
                } else {
                    self.error("name", "N004", format!("Unknown function '{name}'."), node);
                    Type::Void
                }
            }
            _ => Type::Void,
        };
        self.info.types.insert(node.id, ty);
        ty
    }
    fn statements(&mut self, body: &[Node]) -> bool {
        let mut returns = false;
        for node in body {
            let r = self.statement(node);
            returns |= r;
        }
        returns
    }
    fn statement(&mut self, node: &Node) -> bool {
        match &node.data {
            NodeKind::Block { body } => {
                let scope = self.scope(node.span);
                self.scopes.push(scope);
                let r = self.statements(body);
                self.scopes.pop();
                return r;
            }
            NodeKind::Variable { name, ty, value } => {
                let actual = self.expr(value);
                self.check(actual, *ty, value);
                self.declare(node, name, *ty);
            }
            NodeKind::Assignment { name, value } => {
                let binding = self.resolve(node, name);
                let actual = self.expr(value);
                if let Some(b) = binding {
                    self.check(actual, b.ty, value);
                }
            }
            NodeKind::Expression { value } => {
                self.expr(value);
            }
            NodeKind::If {
                condition,
                then,
                otherwise,
            } => {
                let actual = self.expr(condition);
                self.check(actual, Type::Boolean, condition);
                let a = self.statement(then);
                let b = otherwise.as_ref().is_some_and(|n| self.statement(n));
                return a && b;
            }
            NodeKind::While { condition, body } => {
                let actual = self.expr(condition);
                self.check(actual, Type::Boolean, condition);
                self.statement(body);
            }
            NodeKind::Return { value } => {
                let actual = value.as_ref().map_or(Type::Void, |v| self.expr(v));
                if let Some(expected) = self.expected_return {
                    self.check(actual, expected, node);
                } else {
                    self.error(
                        "type",
                        "T008",
                        "return is only valid inside a function.",
                        node,
                    );
                }
                return true;
            }
            NodeKind::Function { .. } => self.error(
                "type",
                "T009",
                "Nested functions are not supported. Declare functions at the top level.",
                node,
            ),
            _ => {}
        }
        false
    }
}
