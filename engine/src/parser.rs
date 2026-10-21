use crate::model::*;
use serde::Serialize;
type Result<T> = std::result::Result<T, ()>;
#[derive(Serialize)]
pub struct Parsed {
    pub ast: Node,
    pub diagnostics: Vec<Diagnostic>,
}
pub fn parse(tokens: &[Token]) -> Parsed {
    let mut parser = Parser {
        tokens,
        pos: 0,
        id: 0,
        depth: 0,
        diagnostics: vec![],
    };
    let mut body = vec![];
    while parser.current().is_some_and(|t| t.kind != "eof") && parser.diagnostics.len() < 100 {
        let before = parser.pos;
        match parser.statement() {
            Ok(node) => body.push(node),
            Err(()) => {
                while parser.current().is_some_and(|t| {
                    t.kind != "eof"
                        && t.lexeme != ";"
                        && !["let", "fn", "if", "while", "return"].contains(&t.lexeme.as_str())
                }) {
                    parser.take();
                }
                if parser.is(";") || parser.pos == before {
                    parser.take();
                }
            }
        }
    }
    let span = Span {
        end: parser.current().map_or(0, |t| t.span.end),
        ..Span::origin()
    };
    let ast = parser.node(NodeKind::Program { body }, span);
    Parsed {
        ast,
        diagnostics: parser.diagnostics,
    }
}
struct Parser<'a> {
    tokens: &'a [Token],
    pos: usize,
    id: u32,
    depth: usize,
    diagnostics: Vec<Diagnostic>,
}
fn precedence(op: &str) -> u8 {
    match op {
        "||" => 1,
        "&&" => 2,
        "==" | "!=" => 3,
        "<" | "<=" | ">" | ">=" => 4,
        "+" | "-" => 5,
        "*" | "/" | "%" => 6,
        _ => 0,
    }
}
impl Parser<'_> {
    fn current(&self) -> Option<&Token> {
        self.tokens.get(self.pos).or(self.tokens.last())
    }
    fn is(&self, text: &str) -> bool {
        self.current().is_some_and(|t| t.lexeme == text)
    }
    fn take(&mut self) -> Token {
        let t = self.current().cloned().unwrap_or(Token {
            span: Span::origin(),
            kind: "eof".into(),
            lexeme: String::new(),
            literal: None,
        });
        self.pos += 1;
        t
    }
    fn fail<T>(&mut self, message: impl Into<String>) -> Result<T> {
        self.diagnostics.push(diagnostic(
            "syntax",
            "P001",
            message,
            self.current().map_or(Span::origin(), |t| t.span),
        ));
        Err(())
    }
    fn expect(&mut self, s: &str) -> Result<Token> {
        if !self.is(s) {
            let found = self.current().map_or("end of file", |t| {
                if t.lexeme.is_empty() {
                    "end of file"
                } else {
                    &t.lexeme
                }
            });
            return self.fail(format!("Expected '{s}', found '{found}'."));
        }
        Ok(self.take())
    }
    fn identifier(&mut self) -> Result<Token> {
        if !self.current().is_some_and(|t| t.kind == "identifier") {
            return self.fail("Expected an identifier.");
        }
        Ok(self.take())
    }
    fn type_name(&mut self) -> Result<Type> {
        let ty = match self.current().map(|t| t.lexeme.as_str()) {
            Some("number") => Type::Number,
            Some("string") => Type::String,
            Some("boolean") => Type::Boolean,
            Some("void") => Type::Void,
            _ => return self.fail("Expected a type: number, string, boolean or void."),
        };
        self.take();
        Ok(ty)
    }
    fn span(&self, start: Span) -> Span {
        Span {
            end: self
                .tokens
                .get(self.pos.saturating_sub(1))
                .map_or(start.end, |t| t.span.end),
            ..start
        }
    }
    fn node(&mut self, data: NodeKind, span: Span) -> Node {
        self.id += 1;
        Node {
            id: self.id,
            span,
            data,
        }
    }
    fn guarded<T>(&mut self, f: impl FnOnce(&mut Self) -> Result<T>) -> Result<T> {
        self.depth += 1;
        let r = if self.depth > 128 {
            self.fail("Syntax nesting exceeds the limit of 128.")
        } else {
            f(self)
        };
        self.depth -= 1;
        r
    }
    fn primary(&mut self) -> Result<Node> {
        self.guarded(|p| {
            let t = p.current().cloned().unwrap();
            if p.is("-") || p.is("!") {
                p.take();
                p.id += 1;
                let id = p.id;
                let operand = Box::new(p.primary()?);
                return Ok(Node {
                    id,
                    span: p.span(t.span),
                    data: NodeKind::Unary {
                        operator: t.lexeme,
                        operand,
                    },
                });
            }
            if p.is("(") {
                p.take();
                let expr = p.expression(1)?;
                p.expect(")")?;
                return Ok(expr);
            }
            if t.kind == "number" || t.kind == "string" || p.is("true") || p.is("false") {
                p.take();
                let value = t.literal.unwrap_or(Primitive::Boolean(t.lexeme == "true"));
                return Ok(p.node(NodeKind::Literal { value }, t.span));
            }
            if t.kind == "identifier" {
                p.take();
                if p.is("(") {
                    p.take();
                    let mut args = vec![];
                    if !p.is(")") {
                        loop {
                            args.push(p.expression(1)?);
                            if !p.is(",") {
                                break;
                            }
                            p.take();
                        }
                    }
                    p.expect(")")?;
                    return Ok(p.node(
                        NodeKind::Call {
                            name: t.lexeme,
                            args,
                        },
                        p.span(t.span),
                    ));
                }
                return Ok(p.node(NodeKind::Identifier { name: t.lexeme }, t.span));
            }
            p.fail("Expected an expression.")
        })
    }
    fn expression(&mut self, min: u8) -> Result<Node> {
        self.guarded(|p| {
            let mut left = p.primary()?;
            while p.current().is_some_and(|t| precedence(&t.lexeme) >= min) {
                let operator = p.take().lexeme;
                let right = p.expression(precedence(&operator) + 1)?;
                let span = Span {
                    end: right.span.end,
                    ..left.span
                };
                left = p.node(
                    NodeKind::Binary {
                        operator,
                        left: Box::new(left),
                        right: Box::new(right),
                    },
                    span,
                );
            }
            Ok(left)
        })
    }
    fn block(&mut self) -> Result<Node> {
        self.guarded(|p| {
            let start = p.expect("{")?.span;
            let mut body = vec![];
            while !p.is("}") && p.current().is_some_and(|t| t.kind != "eof") {
                body.push(p.statement()?);
            }
            p.expect("}")?;
            Ok(p.node(NodeKind::Block { body }, p.span(start)))
        })
    }
    fn statement(&mut self) -> Result<Node> {
        self.guarded(|p| {
            let start = p.current().map_or(Span::origin(), |t| t.span);
            if p.is("{") {
                return p.block();
            }
            let data = if p.is("let") {
                p.take();
                let name = p.identifier()?.lexeme;
                p.expect(":")?;
                let ty = p.type_name()?;
                p.expect("=")?;
                let value = Box::new(p.expression(1)?);
                p.expect(";")?;
                NodeKind::Variable { name, ty, value }
            } else if p.is("fn") {
                p.take();
                let name = p.identifier()?.lexeme;
                p.expect("(")?;
                let mut params = vec![];
                if !p.is(")") {
                    loop {
                        let parameter = p.identifier()?;
                        p.expect(":")?;
                        let ty = p.type_name()?;
                        params.push(p.node(
                            NodeKind::Parameter {
                                name: parameter.lexeme,
                                ty,
                            },
                            p.span(parameter.span),
                        ));
                        if !p.is(",") {
                            break;
                        }
                        p.take();
                    }
                }
                p.expect(")")?;
                p.expect(":")?;
                let return_type = p.type_name()?;
                let body = Box::new(p.block()?);
                NodeKind::Function {
                    name,
                    params,
                    return_type,
                    body,
                }
            } else if p.is("if") {
                p.take();
                p.expect("(")?;
                let condition = Box::new(p.expression(1)?);
                p.expect(")")?;
                let then = Box::new(p.block()?);
                let otherwise = if p.is("else") {
                    p.take();
                    Some(Box::new(if p.is("if") {
                        p.statement()?
                    } else {
                        p.block()?
                    }))
                } else {
                    None
                };
                NodeKind::If {
                    condition,
                    then,
                    otherwise,
                }
            } else if p.is("while") {
                p.take();
                p.expect("(")?;
                let condition = Box::new(p.expression(1)?);
                p.expect(")")?;
                let body = Box::new(p.block()?);
                NodeKind::While { condition, body }
            } else if p.is("return") {
                p.take();
                let value = if p.is(";") {
                    None
                } else {
                    Some(Box::new(p.expression(1)?))
                };
                p.expect(";")?;
                NodeKind::Return { value }
            } else if p.current().is_some_and(|t| t.kind == "identifier")
                && p.tokens.get(p.pos + 1).is_some_and(|t| t.lexeme == "=")
            {
                let name = p.take().lexeme;
                p.take();
                let value = Box::new(p.expression(1)?);
                p.expect(";")?;
                NodeKind::Assignment { name, value }
            } else {
                let value = Box::new(p.expression(1)?);
                p.expect(";")?;
                NodeKind::Expression { value }
            };
            Ok(p.node(data, p.span(start)))
        })
    }
}
