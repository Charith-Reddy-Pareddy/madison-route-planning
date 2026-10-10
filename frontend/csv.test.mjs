import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from './csv.mjs';

test('parses headers, rows, and quoted commas', () => {
  assert.deepEqual(parseCsv('id,name\n1,"Library Mall, Madison"\n'), [
    { id: '1', name: 'Library Mall, Madison' }
  ]);
});

test('parses escaped quotes and CRLF lines', () => {
  assert.deepEqual(parseCsv('id,name\r\n1,"The ""Red"" Gym"\r\n'), [
    { id: '1', name: 'The "Red" Gym' }
  ]);
});

test('rejects rows with a different number of columns', () => {
  assert.throws(() => parseCsv('id,name\n1\n'), /expected 2/);
});

test('rejects unterminated quoted fields', () => {
  assert.throws(() => parseCsv('id,name\n1,"unfinished'), /inside a quoted field/);
});
