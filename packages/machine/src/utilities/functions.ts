const uniquePredicate = <T>(v: T, i: number, a: T[]) => a.indexOf(v) === i;

const idKey = Symbol('idCurrentKey');
const idWeakMapKey = Symbol('idWeakMapKey');

function id(object: Object): number {
  if (!id[idWeakMapKey].has(object)) {
    id[idWeakMapKey].set(object, id[idKey]);
    id[idKey] += 1;
  }

  return id[idWeakMapKey].get(object)!;
}

id[idKey] = 0;
id[idWeakMapKey] = new WeakMap<Object, number>();

export {
  id,
  uniquePredicate,
};
