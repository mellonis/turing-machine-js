const uniquePredicate = <T>(v: T, i: number, a: T[]) => a.indexOf(v) === i;

const idKey = Symbol('idCurrentKey');
const idWeakMapKey = Symbol('idWeakMapKey');

let pendingSentinelId: number | null = null;

// Reserve a fixed id for the NEXT object passed to `id()`. Used by State.ts
// to construct global sentinels (abortState = -1, #239) without consuming
// the 0,1,2,… counter that haltState and user states draw from. Sentinel
// ids are odd negatives assigned once in creation order; even negatives
// belong to toGraph's synthetic halt markers (see stateGraph.ts).
function reserveSentinelId(value: number): void {
  pendingSentinelId = value;
}

function id(object: object): number {
  if (!id[idWeakMapKey].has(object)) {
    if (pendingSentinelId !== null) {
      id[idWeakMapKey].set(object, pendingSentinelId);
      pendingSentinelId = null;
    } else {
      id[idWeakMapKey].set(object, id[idKey]);
      id[idKey] += 1;
    }
  }

  return id[idWeakMapKey].get(object)!;
}

id[idKey] = 0;
id[idWeakMapKey] = new WeakMap<object, number>();

export {
  id,
  uniquePredicate,
  reserveSentinelId,
};
