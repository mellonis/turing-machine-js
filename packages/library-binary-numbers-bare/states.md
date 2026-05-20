# library-binary-numbers-bare — state graphs

## plusOne

*3 states; 5 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s1["plusOneCarry"]
  s2["plusOne"]
  idle([idle])
  idle -. enter .-> s2
  s1 -- "'1' → '0'/L" --> s1
  s1 -- "'0' → '1'/S" --> s0
  s1 -- "B → '1'/S" --> s0
  s2 -- "'0'|'1' → K/R" --> s2
  s2 -- "B → K/L" --> s1
```

## minusOne

*3 states; 5 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s3["minusOneBorrow"]
  s4["minusOne"]
  idle([idle])
  idle -. enter .-> s4
  s3 -- "'0' → '1'/L" --> s3
  s3 -- "'1' → '0'/S" --> s0
  s3 -- "B → K/S" --> s0
  s4 -- "'0'|'1' → K/R" --> s4
  s4 -- "B → K/L" --> s3
```

## invertNumber

*2 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s5["invertNumber"]
  idle([idle])
  idle -. enter .-> s5
  s5 -- "'0' → '1'/R" --> s5
  s5 -- "'1' → '0'/R" --> s5
  s5 -- "B → K/S" --> s0
```

## normalizeNumber

*2 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  s6["normalizeNumber"]
  idle([idle])
  idle -. enter .-> s6
  s6 -- "'0' → E/R" --> s6
  s6 -- "'1' → K/S" --> s0
  s6 -- "B → '0'/S" --> s0
```
