/**
 * Lightweight, dependency-free Luau source scanner.
 *
 * Blanks out comment bodies and string-literal contents (replacing each
 * stripped character with a space so column positions are preserved). Rules
 * run against this "code" view so regex patterns never match text that lives
 * inside a string or comment — the single biggest source of linter false
 * positives.
 *
 * Handles: line comments (`--`), block comments (`--[[ ]]`, `--[=[ ]=]`),
 * single/double quoted strings with `\` escapes, and long-bracket strings
 * (`[[ ]]`, `[=[ ]=]`). Block comments and long strings may span lines.
 *
 * This is intentionally a scanner, not a parser: it is robust enough for
 * line/regex rules without pulling in a Luau grammar dependency (ADR-001).
 */

export function stripSource(source: string): string[] {
  const rawLines = source.split(/\r?\n/);
  const out: string[] = [];

  // State that persists across lines:
  let inLongBracket = false; // inside [[ ]] / [=[ ]=] (string or block comment)
  let longLevel = 0; // number of '=' in the opening bracket
  let inString: '"' | "'" | null = null;

  for (const line of rawLines) {
    let res = "";
    let i = 0;
    let inLineComment = false; // resets every line

    while (i < line.length) {
      const ch = line[i];

      if (inLongBracket) {
        const close = "]" + "=".repeat(longLevel) + "]";
        if (line.startsWith(close, i)) {
          res += " ".repeat(close.length);
          i += close.length;
          inLongBracket = false;
          longLevel = 0;
        } else {
          res += " ";
          i++;
        }
        continue;
      }

      if (inString) {
        if (ch === "\\") {
          // escape sequence: blank this char and the next
          res += " ";
          i++;
          if (i < line.length) {
            res += " ";
            i++;
          }
          continue;
        }
        if (ch === inString) {
          res += ch; // keep the closing quote
          inString = null;
          i++;
          continue;
        }
        res += " ";
        i++;
        continue;
      }

      if (inLineComment) {
        res += " ";
        i++;
        continue;
      }

      // Not currently inside anything — look for an opener.

      // Comment: -- (maybe a block comment --[[ )
      if (line.startsWith("--", i)) {
        const m = line.slice(i + 2).match(/^\[(=*)\[/);
        if (m) {
          longLevel = m[1].length;
          inLongBracket = true;
          const consumed = 2 + m[0].length;
          res += " ".repeat(consumed);
          i += consumed;
        } else {
          inLineComment = true;
          res += "  ";
          i += 2;
        }
        continue;
      }

      // Long-bracket string: [[ or [=[
      const lm = line.slice(i).match(/^\[(=*)\[/);
      if (lm) {
        longLevel = lm[1].length;
        inLongBracket = true;
        res += " ".repeat(lm[0].length);
        i += lm[0].length;
        continue;
      }

      // Quoted string
      if (ch === '"' || ch === "'") {
        inString = ch;
        res += ch; // keep the opening quote
        i++;
        continue;
      }

      res += ch;
      i++;
    }

    // Line comments and short strings do not continue onto the next line.
    inString = null;
    out.push(res);
  }

  return out;
}
