import { Command } from '@turing-machine-js/machine';

describe('Command constructor', () => {
  test('throws an exception on invalid symbol', () => {
    expect(() => new Command({
      symbol: '',
    }))
      .toThrow('Invalid symbol');
  });

  test('throws an exception on invalid movement', () => {
    expect(() => new Command({
      symbol: 'a',
      movement: null,
    }))
      .toThrow('Invalid movement');
  });

  test('throws an exception on invalid nextStep', () => {
    expect(() => new Command({
      symbol: 'a',
    }))
      .toThrow('Invalid nextStep');
  });
});
