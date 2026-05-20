# library-binary-numbers-bare — state graphs

## plusOne

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s1["plusOneCarry"]
  s2["plusOne"]
  idle([idle])
  idle -. enter .-> s2
  s1 -- "'1' → '0'/←" --> s1
  s1 -- "'0' → '1'/⇹" --> s0
  s1 -- "- → '1'/⇹" --> s0
  s2 -- "'0'|'1' → K/→" --> s2
  s2 -- "- → K/←" --> s1
```

## minusOne

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s3["minusOneBorrow"]
  s4["minusOne"]
  idle([idle])
  idle -. enter .-> s4
  s3 -- "'0' → '1'/←" --> s3
  s3 -- "'1' → '0'/⇹" --> s0
  s3 -- "- → K/⇹" --> s0
  s4 -- "'0'|'1' → K/→" --> s4
  s4 -- "- → K/←" --> s3
```

## invertNumber

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s5["invertNumber"]
  idle([idle])
  idle -. enter .-> s5
  s5 -- "'0' → '1'/→" --> s5
  s5 -- "'1' → '0'/→" --> s5
  s5 -- "- → K/⇹" --> s0
```

## normalizeNumber

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s6["normalizeNumber"]
  idle([idle])
  idle -. enter .-> s6
  s6 -- "'0' → E/→" --> s6
  s6 -- "'1' → K/⇹" --> s0
  s6 -- "- → '0'/⇹" --> s0
```
