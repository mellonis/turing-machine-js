import TapeCommand from './TapeCommand';

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
      movement: Symbol('some symbol'),
    }))
      .toThrow('invalid movement');
  });
});
