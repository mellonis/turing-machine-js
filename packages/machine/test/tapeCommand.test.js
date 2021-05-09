import { TapeCommand } from '@turing-machine-js/machine';

describe('TapeCommand constructor', () => {
  test('throws an exception on invalid symbol', () => {
    expect(() => new TapeCommand({
      symbol: '',
    }))
      .toThrow('invalid symbol');
  });

  test('throws an exception on invalid movement', () => {
    expect(() => new TapeCommand({
      symbol: 'a',
      movement: null,
    }))
      .toThrow('invalid movement');
  });
});
