# library-binary-numbers — state graphs

## goToNumber

*2 states; 2 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u1["goToNumber"]
  idle([idle])
  idle -. enter .-> u1
  u1 -- "['$'] → [K]/[S]" --> s0
  u1 -- "[*] → [K]/[R]" --> u1
```

## goToNextNumber

*3 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u1["goToNumber"]
  u2["goToNextNumber"]
  idle([idle])
  idle -. enter .-> u2
  u1 -- "['$'] → [K]/[S]" --> s0
  u1 -- "[*] → [K]/[R]" --> u1
  u2 -- "[*] → [K]/[R]" --> u1
```

## goToPreviousNumber

*3 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u3["goToPreviousNumberInternal"]
  u4["goToPreviousNumber"]
  idle([idle])
  idle -. enter .-> u4
  u3 -- "['$'] → [K]/[S]" --> s0
  u3 -- "[*] → [K]/[L]" --> u3
  u4 -- "[*] → [K]/[L]" --> u3
```

## deleteNumber

*5 states; 6 transitions; 1 wrapper (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u6["deleteNumberInternal"]
  u8["deleteNumber"]
  u7[["goToNumberStart(deleteNumberInternal)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    u5["goToNumberStart"]
    s0-5(((halt)))
  end
  idle -. enter .-> u8
  u7 == "call" ==> u5
  w_5 -. "return" .-> u7
  u7 --> u6
  u5 -- "['^'] → [K]/[S]" --> s0-5
  u5 -- "[*] → [K]/[L]" --> u5
  u6 -- "['$'] → [E]/[S]" --> s0
  u6 -- "[*] → [E]/[R]" --> u6
  u8 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> u7
  u8 -- "[*] → [K]/[S]" --> s0
```

## goToNumbersStart

*2 states; 2 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u5["goToNumberStart"]
  idle([idle])
  idle -. enter .-> u5
  u5 -- "['^'] → [K]/[S]" --> s0
  u5 -- "[*] → [K]/[L]" --> u5
```

## invertNumber

*5 states; 8 transitions; 1 wrapper (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u9["invertNumberGoToNumberWithInversion"]
  u11["invertNumber"]
  u10[["goToNumberStart(invertNumberGoToNumberWithInversion)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    u5["goToNumberStart"]
    s0-5(((halt)))
  end
  idle -. enter .-> u11
  u10 == "call" ==> u5
  w_5 -. "return" .-> u10
  u10 --> u9
  u5 -- "['^'] → [K]/[S]" --> s0-5
  u5 -- "[*] → [K]/[L]" --> u5
  u9 -- "['^'] → [K]/[R]" --> u9
  u9 -- "['1'] → ['0']/[R]" --> u9
  u9 -- "['0'] → ['1']/[R]" --> u9
  u9 -- "['$'] → [K]/[S]" --> s0
  u11 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> u10
  u11 -- "[*] → [K]/[S]" --> s0
```

## normalizeNumber

*7 states; 9 transitions; 1 wrapper (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u1["goToNumber"]
  u12["normalizeNumberPutNewStartSymbol"]
  u13["normalizeNumberMoveNumberStart"]
  u15["normalizeNumber"]
  u14[["goToNumberStart(normalizeNumberMoveNumberStart)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    u5["goToNumberStart"]
    s0-5(((halt)))
  end
  idle -. enter .-> u15
  u14 == "call" ==> u5
  w_5 -. "return" .-> u14
  u14 --> u13
  u1 -- "['$'] → [K]/[S]" --> s0
  u1 -- "[*] → [K]/[R]" --> u1
  u5 -- "['^'] → [K]/[S]" --> s0-5
  u5 -- "[*] → [K]/[L]" --> u5
  u12 -- "[B] → ['^']/[S]" --> u1
  u13 -- "['^']|['0'] → [E]/[R]" --> u13
  u13 -- "['1']|['$'] → [K]/[L]" --> u12
  u15 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> u14
  u15 -- "[*] → [K]/[S]" --> s0
```

## plusOne

*5 states; 10 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u16["plusOneFillZeros"]
  u17["plusOneAddNumberStart"]
  u18["plusOneCaryOne"]
  u19["plusOne"]
  idle([idle])
  idle -. enter .-> u19
  u16 -- "['1'] → ['0']/[R]" --> u16
  u16 -- "['$'] → [K]/[S]" --> s0
  u17 -- "[B] → ['^']/[R]" --> u17
  u17 -- "['1'] → [K]/[R]" --> u16
  u18 -- "['0'] → ['1']/[R]" --> u16
  u18 -- "['1'] → [K]/[L]" --> u18
  u18 -- "['^'] → ['1']/[L]" --> u17
  u19 -- "['^']|['1']|['0'] → [K]/[R]" --> u19
  u19 -- "['$'] → [K]/[L]" --> u18
  u19 -- "[*] → [K]/[S]" --> s0
```

## minusOne

*18 states; 28 transitions; 5 wrappers (max nesting depth 3); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u1["goToNumber"]
  u12["normalizeNumberPutNewStartSymbol"]
  u13["normalizeNumberMoveNumberStart"]
  u15["normalizeNumber"]
  u23["minusOne"]
  u14[["goToNumberStart(normalizeNumberMoveNumberStart)"]]
  u20[["invertNumber(normalizeNumber)"]]
  u21[["plusOne(invertNumber(normalizeNumber))"]]
  u22[["invertNumber(plusOne(invertNumber(normalizeNumber)))"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    u5["goToNumberStart"]
    s0-5(((halt)))
  end
  subgraph w_11["callable subtree of invertNumber"]
    u9["invertNumberGoToNumberWithInversion"]
    u10[["goToNumberStart(invertNumberGoToNumberWithInversion)"]]
    u11["invertNumber"]
    s0-11(((halt)))
  end
  subgraph w_19["callable subtree of plusOne"]
    u16["plusOneFillZeros"]
    u17["plusOneAddNumberStart"]
    u18["plusOneCaryOne"]
    u19["plusOne"]
    s0-19(((halt)))
  end
  idle -. enter .-> u23
  u10 & u14 == "call" ==> u5
  u20 & u22 == "call" ==> u11
  u21 == "call" ==> u19
  w_5 -. "return" .-> u10 & u14
  w_11 -. "return" .-> u20 & u22
  w_19 -. "return" .-> u21
  u10 --> u9
  u14 --> u13
  u20 --> u15
  u21 --> u20
  u22 --> u21
  u1 -- "['$'] → [K]/[S]" --> s0
  u1 -- "[*] → [K]/[R]" --> u1
  u5 -- "['^'] → [K]/[S]" --> s0-5
  u5 -- "[*] → [K]/[L]" --> u5
  u9 -- "['^'] → [K]/[R]" --> u9
  u9 -- "['1'] → ['0']/[R]" --> u9
  u9 -- "['0'] → ['1']/[R]" --> u9
  u9 -- "['$'] → [K]/[S]" --> s0-11
  u11 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> u10
  u11 -- "[*] → [K]/[S]" --> s0-11
  u12 -- "[B] → ['^']/[S]" --> u1
  u13 -- "['^']|['0'] → [E]/[R]" --> u13
  u13 -- "['1']|['$'] → [K]/[L]" --> u12
  u15 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> u14
  u15 -- "[*] → [K]/[S]" --> s0
  u16 -- "['1'] → ['0']/[R]" --> u16
  u16 -- "['$'] → [K]/[S]" --> s0-19
  u17 -- "[B] → ['^']/[R]" --> u17
  u17 -- "['1'] → [K]/[R]" --> u16
  u18 -- "['0'] → ['1']/[R]" --> u16
  u18 -- "['1'] → [K]/[L]" --> u18
  u18 -- "['^'] → ['1']/[L]" --> u17
  u19 -- "['^']|['1']|['0'] → [K]/[R]" --> u19
  u19 -- "['$'] → [K]/[L]" --> u18
  u19 -- "[*] → [K]/[S]" --> s0-19
  u23 -- "['^']|['1']|['0'] → [K]/[R]" --> u23
  u23 -- "['$'] → [K]/[S]" --> u22
  u23 -- "[*] → [K]/[S]" --> s0
```

## minusOneFast

*10 states; 15 transitions; 2 wrappers (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  u1["goToNumber"]
  u12["normalizeNumberPutNewStartSymbol"]
  u13["normalizeNumberMoveNumberStart"]
  u15["normalizeNumber"]
  u26["minusOneFast"]
  u14[["goToNumberStart(normalizeNumberMoveNumberStart)"]]
  u25[["minusOneFastBorrow(normalizeNumber)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    u5["goToNumberStart"]
    s0-5(((halt)))
  end
  subgraph w_24["callable subtree of minusOneFastBorrow"]
    u24["minusOneFastBorrow"]
    s0-24(((halt)))
  end
  idle -. enter .-> u26
  u14 == "call" ==> u5
  u25 == "call" ==> u24
  w_5 -. "return" .-> u14
  w_24 -. "return" .-> u25
  u14 --> u13
  u25 --> u15
  u1 -- "['$'] → [K]/[S]" --> s0
  u1 -- "[*] → [K]/[R]" --> u1
  u5 -- "['^'] → [K]/[S]" --> s0-5
  u5 -- "[*] → [K]/[L]" --> u5
  u12 -- "[B] → ['^']/[S]" --> u1
  u13 -- "['^']|['0'] → [E]/[R]" --> u13
  u13 -- "['1']|['$'] → [K]/[L]" --> u12
  u15 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> u14
  u15 -- "[*] → [K]/[S]" --> s0
  u24 -- "['1'] → ['0']/[S]" --> s0-24
  u24 -- "['0'] → ['1']/[L]" --> u24
  u24 -- "['^'] → [K]/[S]" --> s0-24
  u26 -- "['^']|['1']|['0'] → [K]/[R]" --> u26
  u26 -- "['$'] → [K]/[L]" --> u25
  u26 -- "[*] → [K]/[S]" --> s0
```
