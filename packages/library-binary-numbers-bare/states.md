# library-binary-numbers-bare — state graphs

## plusOne

*3 states; 5 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  u1["plusOneCarry"]
  u2["plusOne"]
  idle([idle])
  idle -. enter .-> u2
  u1 -- "['1'] → ['0']/[L]" --> u1
  u1 -- "['0'] → ['1']/[S]" --> s0
  u1 -- "[B] → ['1']/[S]" --> s0
  u2 -- "['0']|['1'] → [K]/[R]" --> u2
  u2 -- "[B] → [K]/[L]" --> u1
```

## minusOne

*3 states; 5 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  u3["minusOneBorrow"]
  u4["minusOne"]
  idle([idle])
  idle -. enter .-> u4
  u3 -- "['0'] → ['1']/[L]" --> u3
  u3 -- "['1'] → ['0']/[S]" --> s0
  u3 -- "[B] → [K]/[S]" --> s0
  u4 -- "['0']|['1'] → [K]/[R]" --> u4
  u4 -- "[B] → [K]/[L]" --> u3
```

## invertNumber

*2 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  u5["invertNumber"]
  idle([idle])
  idle -. enter .-> u5
  u5 -- "['0'] → ['1']/[R]" --> u5
  u5 -- "['1'] → ['0']/[R]" --> u5
  u5 -- "[B] → [K]/[S]" --> s0
```

## normalizeNumber

*2 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"]]
  s0(((halt)))
  u6["normalizeNumber"]
  idle([idle])
  idle -. enter .-> u6
  u6 -- "['0'] → [E]/[R]" --> u6
  u6 -- "['1'] → [K]/[S]" --> s0
  u6 -- "[B] → ['0']/[S]" --> s0
```
