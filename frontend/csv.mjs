/** Parse a header-based CSV string, including quoted commas and escaped quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
    } else if (character === ',') {
      row.push(field);
      field = '';
      quoteClosed = false;
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') {
        index++;
      }
      row.push(field);
      if (row.some(value => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
      quoteClosed = false;
    } else if (quoteClosed) {
      if (!/\s/.test(character)) {
        throw new Error(`Unexpected character after a quoted CSV field at offset ${index}.`);
      }
    } else if (character === '"') {
      if (field.length !== 0) {
        throw new Error(`Unexpected quote in an unquoted CSV field at offset ${index}.`);
      }
      quoted = true;
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error('CSV ends inside a quoted field.');
  }
  row.push(field);
  if (row.some(value => value.length > 0)) {
    rows.push(row);
  }
  if (rows.length === 0) {
    throw new Error('CSV has no header row.');
  }

  const headers = rows.shift().map(header => header.trim());
  if (headers.some(header => header.length === 0) || new Set(headers).size !== headers.length) {
    throw new Error('CSV header has an empty or duplicate column name.');
  }

  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}
