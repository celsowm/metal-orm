import { caseWhen, cast, div, eq, inList, valueToOperand, columnOperand, ValueOperandInput } from '../../../ast/expression-builders.js';
import { isOperandNode } from '../../../ast/expression-nodes.js';
import type { OperandNode } from '../../../ast/expression.js';
import type { ColumnRef } from '../../../ast/types.js';
import { concat, lower } from '../../../functions/text.js';

type OperandInput = OperandNode | ColumnRef | string | number | boolean | null;

const isColumnReference = (value: unknown): value is ColumnRef =>
  typeof value === 'object' &&
  value !== null &&
  !('type' in value) &&
  'name' in value &&
  typeof (value as ColumnRef).name === 'string';

const toOperandNode = (value: OperandInput): OperandNode => {
  if (isOperandNode(value)) return value;
  if (isColumnReference(value)) return columnOperand(value);
  return valueToOperand(value as ValueOperandInput);
};

const fn = (name: string, args: OperandInput[]): OperandNode => ({
  type: 'Function',
  name,
  fn: name,
  args: args.map(arg => toOperandNode(arg))
});

const CHAR_TYPES = ['varchar', 'char', 'varbinary', 'binary', 'nvarchar', 'nchar'];
const DECIMAL_TYPES = ['decimal', 'numeric'];

/**
 * Returns an expression that calls OBJECT_DEFINITION for the given object ID.
 * Used to retrieve the source text of views, procedures, etc.
 */
export const objectDefinition = (objectId: OperandInput): OperandNode => fn('OBJECT_DEFINITION', [objectId]);

/**
 * Builds a SQL Server data type string representation from its components.
 * 
 * @param typeName The base type name.
 * @param maxLength The maximum length for char/binary types.
 * @param precision The precision for decimal/numeric types.
 * @param scale The scale for decimal/numeric types.
 * @returns An expression that evaluates to the full data type string.
 */
export const buildMssqlDataType = (
  typeName: OperandInput,
  maxLength: OperandInput,
  precision: OperandInput,
  scale: OperandInput
): OperandNode => {
  const typeOperand = toOperandNode(typeName);
  const maxLenOperand = toOperandNode(maxLength);
  const precisionOperand = toOperandNode(precision);
  const scaleOperand = toOperandNode(scale);
  const typeLower = lower(typeOperand);

  const lengthCase = caseWhen(
    [
      {
        when: eq(maxLenOperand, -1),
        then: 'max'
      },
      {
        when: inList(typeLower, ['nvarchar', 'nchar']),
        then: cast(div(maxLenOperand, 2), 'varchar(10)')
      }
    ],
    cast(maxLenOperand, 'varchar(10)')
  );

  const charSuffix = concat('(', lengthCase, ')');

  const decimalSuffix = concat(
    '(',
    cast(precisionOperand, 'varchar(10)'),
    ',',
    cast(scaleOperand, 'varchar(10)'),
    ')'
  );

  const suffix = caseWhen(
    [
      { when: inList(typeLower, CHAR_TYPES), then: charSuffix },
      { when: inList(typeLower, DECIMAL_TYPES), then: decimalSuffix }
    ],
    ''
  );

  return concat(typeLower, suffix);
};

export default {
  objectDefinition,
  buildMssqlDataType
};
