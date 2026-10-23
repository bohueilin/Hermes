// Decimal text avoids native accessibility float32 expansion; validation stays in the model.
export const decimalValue=s=>/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim())?Number(s):NaN;
