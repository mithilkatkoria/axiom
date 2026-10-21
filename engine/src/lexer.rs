use crate::model::*;
use serde::Serialize;

#[derive(Serialize)]
pub struct Lexed {
    pub tokens: Vec<Token>,
    pub diagnostics: Vec<Diagnostic>,
}
pub fn tokenize(source: &str) -> Lexed {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut lexer = Lexer {
        source: &units,
        pos: 0,
        line: 1,
        column: 1,
        tokens: vec![],
        diagnostics: vec![],
    };
    if units.len() > 100_000 {
        return Lexed {
            tokens: vec![],
            diagnostics: vec![diagnostic(
                "lexical",
                "L000",
                "Source exceeds the 100,000 character limit.",
                Span::origin(),
            )],
        };
    }
    while lexer.pos < units.len() && lexer.diagnostics.len() < 100 {
        lexer.next();
    }
    lexer.tokens.push(Token {
        span: Span {
            start: units.len(),
            end: units.len(),
            line: lexer.line,
            column: lexer.column,
        },
        kind: "eof".into(),
        lexeme: String::new(),
        literal: None,
    });
    Lexed {
        tokens: lexer.tokens,
        diagnostics: lexer.diagnostics,
    }
}
struct Lexer<'a> {
    source: &'a [u16],
    pos: usize,
    line: usize,
    column: usize,
    tokens: Vec<Token>,
    diagnostics: Vec<Diagnostic>,
}
fn digit(c: u16) -> bool {
    (48..=57).contains(&c)
}
fn alpha(c: u16) -> bool {
    (65..=90).contains(&c) || (97..=122).contains(&c) || c == 95
}
fn whitespace(c: u16) -> bool {
    matches!(c,9..=13|32|160|0x1680|0x2000..=0x200a|0x2028|0x2029|0x202f|0x205f|0x3000|0xfeff)
}
impl Lexer<'_> {
    fn at(&self, offset: usize) -> u16 {
        self.source
            .get(self.pos + offset)
            .copied()
            .unwrap_or(0xffff)
    }
    fn take(&mut self) -> u16 {
        let c = self.at(0);
        if self.pos < self.source.len() {
            self.pos += 1;
            if c == 10 {
                self.line += 1;
                self.column = 1;
            } else {
                self.column += 1;
            }
        }
        c
    }
    fn text(&self, start: usize) -> String {
        String::from_utf16_lossy(&self.source[start..self.pos])
    }
    fn error(&mut self, code: &str, message: impl Into<String>, start: Span) {
        self.diagnostics.push(diagnostic(
            "lexical",
            code,
            message,
            Span {
                end: self.pos,
                ..start
            },
        ));
    }
    fn token(&mut self, start: Span, kind: &str, literal: Option<Primitive>) {
        self.tokens.push(Token {
            span: Span {
                end: self.pos,
                ..start
            },
            kind: kind.into(),
            lexeme: self.text(start.start),
            literal,
        });
    }
    fn next(&mut self) {
        let c = self.at(0);
        if whitespace(c) {
            self.take();
            return;
        }
        let start = Span {
            start: self.pos,
            end: self.pos,
            line: self.line,
            column: self.column,
        };
        if c == 47 && self.at(1) == 47 {
            while self.pos < self.source.len() && self.at(0) != 10 {
                self.take();
            }
            return;
        }
        if c == 47 && self.at(1) == 42 {
            self.take();
            self.take();
            while self.pos < self.source.len() && !(self.at(0) == 42 && self.at(1) == 47) {
                self.take();
            }
            if self.pos == self.source.len() {
                self.error("L001", "Unterminated block comment. Add */.", start);
            } else {
                self.take();
                self.take();
            }
            return;
        }
        if alpha(c) {
            while alpha(self.at(0)) || digit(self.at(0)) {
                self.take();
            }
            let text = self.text(start.start);
            let kind = if [
                "let", "fn", "if", "else", "while", "return", "true", "false", "number", "string",
                "boolean", "void",
            ]
            .contains(&text.as_str())
            {
                "keyword"
            } else {
                "identifier"
            };
            self.token(start, kind, None);
        } else if digit(c) {
            while digit(self.at(0)) {
                self.take();
            }
            if self.at(0) == 46 && digit(self.at(1)) {
                self.take();
                while digit(self.at(0)) {
                    self.take();
                }
            }
            if self.at(0) == 101 || self.at(0) == 69 {
                self.take();
                if self.at(0) == 43 || self.at(0) == 45 {
                    self.take();
                }
                let exponent = self.pos;
                while digit(self.at(0)) {
                    self.take();
                }
                if exponent == self.pos {
                    self.error("L002", "Expected digits after the exponent.", start);
                }
            }
            let n = self.text(start.start).parse::<f64>().unwrap_or(f64::NAN);
            if !n.is_finite() {
                self.error("L003", "Number literal must be finite.", start);
            }
            self.token(start, "number", Some(Primitive::Number(n)));
        } else if c == 34 {
            self.take();
            let mut literal = vec![];
            let mut closed = false;
            while self.pos < self.source.len() {
                let ch = self.take();
                if ch == 34 {
                    closed = true;
                    break;
                }
                if ch == 10 || ch == 13 {
                    self.error(
                        "L004",
                        "String literals cannot cross a line. Use \\n.",
                        start,
                    );
                    break;
                }
                if ch == 92 {
                    let escaped = self.take();
                    let value = match escaped {
                        110 => Some(10),
                        114 => Some(13),
                        116 => Some(9),
                        34 => Some(34),
                        92 => Some(92),
                        48 => Some(0),
                        _ => None,
                    };
                    if let Some(value) = value {
                        literal.push(value);
                    } else {
                        let text = if escaped == 0xffff {
                            String::new()
                        } else {
                            String::from_utf16_lossy(&[escaped])
                        };
                        self.error(
                            "L005",
                            format!("Unsupported escape sequence \\{text}."),
                            start,
                        );
                    }
                } else {
                    literal.push(ch);
                }
            }
            if !closed {
                self.error(
                    "L006",
                    "Unterminated string literal. Add a closing quote.",
                    start,
                );
            }
            self.token(
                start,
                "string",
                Some(Primitive::String(String::from_utf16_lossy(&literal))),
            );
        } else {
            let pair = String::from_utf16_lossy(&[c, self.at(1)]);
            if ["==", "!=", "<=", ">=", "&&", "||"].contains(&pair.as_str()) {
                self.take();
                self.take();
                self.token(start, "operator", None);
            } else if c < 128 && "+-*/%!=<>".contains(c as u8 as char) {
                self.take();
                self.token(start, "operator", None);
            } else if c < 128 && "(){}:;,".contains(c as u8 as char) {
                self.take();
                self.token(start, "punctuation", None);
            } else {
                self.take();
                self.error(
                    "L007",
                    format!("Unexpected character '{}'.", String::from_utf16_lossy(&[c])),
                    start,
                );
            }
        }
        if self.tokens.len() > 20_000 {
            self.error("L008", "Token limit exceeded (20,000).", start);
            self.pos = self.source.len();
        }
    }
}
