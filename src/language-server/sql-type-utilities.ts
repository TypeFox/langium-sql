import { TypeDescriptor } from "./sql-type-descriptors";

const NumericLiteralPattern = /^(\d+)((\.(\d)+)?([eE]([\-+]?\d+))?)?$/;
export function getTypeOfNumericLiteral(text: string): TypeDescriptor | undefined {
  //TODO implement it properly, maybe with notes from here: https://crate.io/docs/sql-99/en/latest//chapters/03.html#choosing-the-right-data-type
  const match = NumericLiteralPattern.exec(text)!;
  const integerPart = match[1].length;
  const fractionalPart = match[4]?.length ?? 0;
  const exponent = parseInt(match[6] ?? '0', 10);
  return {
    discriminator: 'numeric', 
    precision: Math.max(0, integerPart+exponent),
    scale: Math.max(0, fractionalPart-exponent),
  };
}
