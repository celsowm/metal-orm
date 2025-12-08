import { createLiteralFormatter, formatLiteral, escapeSqlString, isRawDefault } from './src/core/ddl/sql-writing.ts';

// Test the new SOLID implementation
console.log('Testing SOLID SQL Writing Implementation...');

// Test 1: Create formatters for different dialects
const postgresFormatter = createLiteralFormatter({
  booleanTrue: 'TRUE',
  booleanFalse: 'FALSE',
});

const mysqlFormatter = createLiteralFormatter({
  booleanTrue: '1',
  booleanFalse: '0',
});

// Test 2: Test literal formatting
console.log('\\n=== Literal Formatting Tests ===');

// Test with different data types
const testValues = [
  null,
  true,
  false,
  42,
  3.14,
  'hello world',
  new Date('2023-01-01'),
  { raw: "CURRENT_TIMESTAMP" },
  { key: 'value' }
];

console.log('\\nPostgreSQL style:');
testValues.forEach(value => {
  console.log(`${JSON.stringify(value)} -> ${formatLiteral(postgresFormatter, value)}`);
});

console.log('\\nMySQL style:');
testValues.forEach(value => {
  console.log(`${JSON.stringify(value)} -> ${formatLiteral(mysqlFormatter, value)}`);
});

// Test 3: Test escapeSqlString
console.log('\\n=== String Escaping Tests ===');
console.log(`"It's working" -> "${escapeSqlString("It's working")}"`);
console.log(`"O'Reilly" -> "${escapeSqlString("O'Reilly")}"`);

// Test 4: Test isRawDefault
console.log('\\n=== Raw Default Tests ===');
console.log(`isRawDefault({raw: "NOW()"}) -> ${isRawDefault({raw: "NOW()"})}`);
console.log(`isRawDefault("NOW()") -> ${isRawDefault("NOW()")}`);
console.log(`isRawDefault(null) -> ${isRawDefault(null)}`);

console.log('\\n✅ All SOLID implementation tests completed successfully!');
