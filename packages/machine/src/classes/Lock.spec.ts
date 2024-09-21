import Lock from './Lock';

describe('Lock', () => {
  let lock: Lock;

  beforeEach(() => {
    lock = new Lock();
  });

  test('can lock and unlock', () => {
    const symbol = Symbol();
    const otherSymbol = Symbol();

    expect(() => lock.check(symbol)).not.toThrow();
    expect(() => lock.check(otherSymbol)).not.toThrow();

    lock.lock(symbol);

    expect(() => lock.check(symbol)).not.toThrow();
    expect(() => lock.check(otherSymbol)).toThrow('Lock check failed');

    lock.unlock(otherSymbol);
    
    expect(() => lock.check(symbol)).not.toThrow();
    expect(() => lock.check(otherSymbol)).toThrow('Lock check failed');

    lock.unlock(symbol);
    expect(() => lock.check(otherSymbol)).not.toThrow();
  })
});
