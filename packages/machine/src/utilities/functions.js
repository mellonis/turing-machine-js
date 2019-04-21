const uniquePredicate = (v, i, a) => a.indexOf(v) === i;

const idKey = Symbol('idCurrentKey');
const idWeakMapKey = Symbol('idWeakMapKey');

function id(object) {
  if (!id[idWeakMapKey].has(object)) {
    id[idKey] += 1;

    id[idWeakMapKey].set(object, id[idKey]);
  }

  return id[idWeakMapKey].get(object);
}

id[idKey] = 0;
id[idWeakMapKey] = new WeakMap();

export {
  id,
  uniquePredicate,
};
