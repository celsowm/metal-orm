export interface SqliteForeignKeyModifier {
  column: string;
  name?: string;
  deferrable: boolean;
}

const isIdentifierChar = (value: string): boolean => /[A-Za-z0-9_]/.test(value);

const keywordAt = (text: string, position: number, keyword: string): boolean => {
  if (position < 0 || position + keyword.length > text.length) return false;
  if (position > 0 && isIdentifierChar(text[position - 1])) return false;
  if (position + keyword.length < text.length && isIdentifierChar(text[position + keyword.length])) {
    return false;
  }
  return text.slice(position, position + keyword.length).toUpperCase() === keyword.toUpperCase();
};

const skipWhitespace = (text: string, position: number): number => {
  let pos = position;
  while (pos < text.length && /\s/.test(text[pos])) pos += 1;
  return pos;
};

const readIdentifier = (text: string, position: number): { value: string; next: number } | undefined => {
  let pos = skipWhitespace(text, position);
  if (pos >= text.length) return undefined;

  const quote = text[pos];
  if (quote === '"' || quote === '`' || quote === '[') {
    const close = quote === '[' ? ']' : quote;
    pos += 1;
    let value = '';
    while (pos < text.length) {
      const current = text[pos++];
      if (current === close) {
        if (pos < text.length && text[pos] === close) {
          value += close;
          pos += 1;
          continue;
        }
        return { value, next: pos };
      }
      value += current;
    }
    return undefined;
  }

  const start = pos;
  while (
    pos < text.length
    && !/\s/.test(text[pos])
    && text[pos] !== '('
    && text[pos] !== ')'
    && text[pos] !== ','
  ) {
    pos += 1;
  }
  if (pos === start) return undefined;
  return { value: text.slice(start, pos), next: pos };
};

const splitTableBody = (createSql: string): string[] => {
  const open = createSql.indexOf('(');
  if (open < 0) return [];

  let depth = 1;
  let quote = '';
  let bracket = false;
  let lineComment = false;
  let blockComment = false;
  let close = -1;

  for (let i = open + 1; i < createSql.length; i += 1) {
    const current = createSql[i];
    const next = createSql[i + 1] ?? '';

    if (lineComment) {
      if (current === '\n' || current === '\r') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (current === quote) {
        if (next === quote) i += 1;
        else quote = '';
      }
      continue;
    }
    if (bracket) {
      if (current === ']') {
        if (next === ']') i += 1;
        else bracket = false;
      }
      continue;
    }
    if (current === '-' && next === '-') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (current === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') {
      quote = current;
      continue;
    }
    if (current === '[') {
      bracket = true;
      continue;
    }
    if (current === '(') depth += 1;
    else if (current === ')') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }

  if (close < 0) return [];
  const body = createSql.slice(open + 1, close);
  const segments: string[] = [];
  let start = 0;
  depth = 0;
  quote = '';
  bracket = false;
  lineComment = false;
  blockComment = false;

  for (let i = 0; i < body.length; i += 1) {
    const current = body[i];
    const next = body[i + 1] ?? '';

    if (lineComment) {
      if (current === '\n' || current === '\r') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (current === quote) {
        if (next === quote) i += 1;
        else quote = '';
      }
      continue;
    }
    if (bracket) {
      if (current === ']') {
        if (next === ']') i += 1;
        else bracket = false;
      }
      continue;
    }
    if (current === '-' && next === '-') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (current === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') {
      quote = current;
      continue;
    }
    if (current === '[') {
      bracket = true;
      continue;
    }
    if (current === '(') depth += 1;
    else if (current === ')' && depth > 0) depth -= 1;
    else if (current === ',' && depth === 0) {
      segments.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }

  segments.push(body.slice(start).trim());
  return segments.filter(Boolean);
};

const findTopLevelKeyword = (text: string, keyword: string, start = 0): number => {
  let depth = 0;
  let quote = '';
  let bracket = false;

  for (let i = start; i < text.length; i += 1) {
    const current = text[i];
    const next = text[i + 1] ?? '';
    if (quote) {
      if (current === quote) {
        if (next === quote) i += 1;
        else quote = '';
      }
      continue;
    }
    if (bracket) {
      if (current === ']') {
        if (next === ']') i += 1;
        else bracket = false;
      }
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') {
      quote = current;
      continue;
    }
    if (current === '[') {
      bracket = true;
      continue;
    }
    if (current === '(') {
      depth += 1;
      continue;
    }
    if (current === ')') {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (depth === 0 && keywordAt(text, i, keyword)) return i;
  }
  return -1;
};

const isInitiallyDeferred = (segment: string, start: number): boolean => {
  const deferrablePos = findTopLevelKeyword(segment, 'DEFERRABLE', start);
  if (deferrablePos < 0) return false;

  const before = segment.slice(start, deferrablePos).trimEnd();
  if (/\bNOT$/i.test(before)) return false;

  return /^DEFERRABLE\s+INITIALLY\s+DEFERRED\b/i.test(segment.slice(deferrablePos));
};

const parseTableForeignKey = (segment: string): SqliteForeignKeyModifier | undefined => {
  let pos = skipWhitespace(segment, 0);
  let name: string | undefined;

  if (keywordAt(segment, pos, 'CONSTRAINT')) {
    pos += 'CONSTRAINT'.length;
    const parsedName = readIdentifier(segment, pos);
    if (!parsedName) return undefined;
    name = parsedName.value;
    pos = skipWhitespace(segment, parsedName.next);
  }

  if (!keywordAt(segment, pos, 'FOREIGN')) return undefined;
  pos += 'FOREIGN'.length;
  pos = skipWhitespace(segment, pos);
  if (!keywordAt(segment, pos, 'KEY')) return undefined;
  pos += 'KEY'.length;
  pos = skipWhitespace(segment, pos);
  if (segment[pos] !== '(') return undefined;
  pos += 1;

  const source = readIdentifier(segment, pos);
  if (!source) return undefined;
  pos = skipWhitespace(segment, source.next);
  if (segment[pos] === ',') return undefined;

  const referencesPos = findTopLevelKeyword(segment, 'REFERENCES', pos);
  if (referencesPos < 0) return undefined;

  return {
    column: source.value,
    ...(name ? { name } : {}),
    deferrable: isInitiallyDeferred(segment, referencesPos)
  };
};

const parseInlineForeignKey = (segment: string): SqliteForeignKeyModifier | undefined => {
  const source = readIdentifier(segment, 0);
  if (!source) return undefined;

  const referencesPos = findTopLevelKeyword(segment, 'REFERENCES', source.next);
  if (referencesPos < 0) return undefined;

  let name: string | undefined;
  const constraintPos = findTopLevelKeyword(segment, 'CONSTRAINT', source.next);
  if (constraintPos >= 0 && constraintPos < referencesPos) {
    const parsedName = readIdentifier(segment, constraintPos + 'CONSTRAINT'.length);
    if (parsedName) name = parsedName.value;
  }

  return {
    column: source.value,
    ...(name ? { name } : {}),
    deferrable: isInitiallyDeferred(segment, referencesPos)
  };
};

export const parseSqliteForeignKeyModifiers = (createSql: string): SqliteForeignKeyModifier[] => {
  const result: SqliteForeignKeyModifier[] = [];
  for (const segment of splitTableBody(createSql)) {
    const tableConstraint = parseTableForeignKey(segment);
    if (tableConstraint) {
      result.push(tableConstraint);
      continue;
    }
    const inlineConstraint = parseInlineForeignKey(segment);
    if (inlineConstraint) result.push(inlineConstraint);
  }
  return result;
};
