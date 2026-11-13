/**
 * A tiny, safe calculator for amount fields: numbers, + − × ÷, parentheses.
 * No `eval` — expressions are tokenized and evaluated with precedence.
 */

type Token = { kind: "num"; value: number } | { kind: "op"; value: "+" | "-" | "*" | "/" } | { kind: "paren"; value: "(" | ")" };

const NORMALIZE: Record<string, string> = { "×": "*", x: "*", X: "*", "÷": "/", "−": "-", "–": "-" };

function tokenize(input: string): Token[] | null {
  const text = input.replace(/[×xX÷−–]/g, (c) => NORMALIZE[c]).replace(/,/g, "").replace(/\s+/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < text.length && /[\d.]/.test(text[j])) j++;
      const raw = text.slice(i, j);
      if ((raw.match(/\./g) ?? []).length > 1 || raw === ".") return null;
      tokens.push({ kind: "num", value: Number(raw) });
      i = j;
    } else if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ kind: "op", value: c });
      i++;
    } else if (c === "(" || c === ")") {
      tokens.push({ kind: "paren", value: c });
      i++;
    } else {
      return null;
    }
  }
  return tokens;
}

/** Evaluates an expression like "120 + 45×2". Returns null when it isn't a complete, valid expression. */
export function evaluateExpression(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens || !tokens.length) return null;
  let pos = 0;

  const peek = () => tokens[pos];
  // expr := term (('+'|'-') term)*
  const expr = (): number | null => {
    let left = term();
    while (left !== null && peek()?.kind === "op" && (peek()!.value === "+" || peek()!.value === "-")) {
      const op = tokens[pos++].value;
      const right = term();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };
  // term := factor (('*'|'/') factor)*
  const term = (): number | null => {
    let left = factor();
    while (left !== null && peek()?.kind === "op" && (peek()!.value === "*" || peek()!.value === "/")) {
      const op = tokens[pos++].value;
      const right = factor();
      if (right === null) return null;
      if (op === "/" && right === 0) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };
  // factor := number | '(' expr ')' | '-' factor
  const factor = (): number | null => {
    const token = tokens[pos];
    if (!token) return null;
    if (token.kind === "num") {
      pos++;
      return token.value;
    }
    if (token.kind === "op" && token.value === "-") {
      pos++;
      const value = factor();
      return value === null ? null : -value;
    }
    if (token.kind === "paren" && token.value === "(") {
      pos++;
      const value = expr();
      if (value === null || tokens[pos]?.kind !== "paren" || tokens[pos].value !== ")") return null;
      pos++;
      return value;
    }
    return null;
  };

  const result = expr();
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) return null;
  return result;
}

/** True when the text contains arithmetic beyond a plain number. */
export function isExpression(input: string): boolean {
  return /\d\s*[+\-−–*×xX/÷]\s*[\d(]/.test(input) || /[()]/.test(input);
}
