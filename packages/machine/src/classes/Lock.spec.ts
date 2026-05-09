import Lock from './Lock';

describe('Lock', () => {
  let lock: Lock;

  beforeEach(() => {
    lock = new Lock();
  });

  describe('check (when unlocked)', () => {
    test('passes for any symbol', () => {
      const a = Symbol('a');
      const b = Symbol('b');

      expect(() => lock.check(a)).not.toThrow();
      expect(() => lock.check(b)).not.toThrow();
    });

    test('passes for null', () => {
      // The implementation guards on `this.#lockSymbol &&` — when the lock is
      // null, the truthy check short-circuits and never compares.
      expect(() => lock.check(null)).not.toThrow();
    });
  });

  describe('lock (acquiring)', () => {
    test('a free lock takes the symbol', () => {
      const a = Symbol('a');

      lock.lock(a);

      expect(() => lock.check(a)).not.toThrow();
    });

    test('a free lock rejects mismatched check', () => {
      const a = Symbol('a');
      const b = Symbol('b');

      lock.lock(a);

      expect(() => lock.check(b)).toThrow('Lock check failed');
    });

    test('locking again with the same symbol is a no-op (idempotent)', () => {
      const a = Symbol('a');

      lock.lock(a);
      lock.lock(a);

      expect(() => lock.check(a)).not.toThrow();
    });

    test('locking with a DIFFERENT symbol while held is silently ignored', () => {
      // The implementation only stores when `this.#lockSymbol === null`.
      // A second lock(b) call after lock(a) leaves the lock held by `a`,
      // doesn't throw, doesn't replace. Easy to misread the source as "may
      // overwrite or throw" — pin the actual contract.
      const a = Symbol('a');
      const b = Symbol('b');

      lock.lock(a);
      lock.lock(b);

      expect(() => lock.check(a)).not.toThrow();
      expect(() => lock.check(b)).toThrow('Lock check failed');
    });
  });

  describe('unlock (releasing)', () => {
    test('unlocking with the matching symbol releases the lock', () => {
      const a = Symbol('a');

      lock.lock(a);
      lock.unlock(a);

      // Lock now free — any check passes.
      expect(() => lock.check(Symbol('whatever'))).not.toThrow();
    });

    test('unlocking with a DIFFERENT symbol leaves the lock held', () => {
      const a = Symbol('a');
      const b = Symbol('b');

      lock.lock(a);
      lock.unlock(b);

      // Lock still held by `a`.
      expect(() => lock.check(a)).not.toThrow();
      expect(() => lock.check(b)).toThrow('Lock check failed');
    });

    test('unlocking a free lock is a no-op', () => {
      const a = Symbol('a');

      // Never locked — unlock should silently do nothing.
      lock.unlock(a);

      expect(() => lock.check(Symbol('whatever'))).not.toThrow();
    });
  });

  describe('check (when locked)', () => {
    test('throws for null check', () => {
      // `this.#lockSymbol && this.#lockSymbol !== null` — when locked, the
      // truthy-and-not-equal-to-null branch fires and the check throws.
      const a = Symbol('a');
      lock.lock(a);

      expect(() => lock.check(null)).toThrow('Lock check failed');
    });
  });

  describe('lock cycle', () => {
    test('can be reused after a full lock/unlock cycle', () => {
      const a = Symbol('a');
      const b = Symbol('b');

      lock.lock(a);
      lock.unlock(a);
      lock.lock(b); // Now free, takes `b`.

      expect(() => lock.check(b)).not.toThrow();
      expect(() => lock.check(a)).toThrow('Lock check failed');
    });
  });
});
