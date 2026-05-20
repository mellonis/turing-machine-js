# library-binary-numbers-bare — state graphs

## plusOne

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s27["plusOneCarry"]
  s28(("plusOne"))
  s27 -- "1 → 0/L" --> s27
  s27 -- "0 → 1/S" --> s0
  s27 -- "- → 1/S" --> s0
  s28 -- "0|1 → ·/R" --> s28
  s28 -- "- → ·/L" --> s27
```

## minusOne

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s29["minusOneBorrow"]
  s30(("minusOne"))
  s29 -- "0 → 1/L" --> s29
  s29 -- "1 → 0/S" --> s0
  s29 -- "- → ·/S" --> s0
  s30 -- "0|1 → ·/R" --> s30
  s30 -- "- → ·/L" --> s29
```

## invertNumber

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s31(("invertNumber"))
  s31 -- "0 → 1/R" --> s31
  s31 -- "1 → 0/R" --> s31
  s31 -- "- → ·/S" --> s0
```

## normalizeNumber

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s32(("normalizeNumber"))
  s32 -- "0 → ⌫/R" --> s32
  s32 -- "1 → ·/S" --> s0
  s32 -- "- → 0/S" --> s0
```
