# library-binary-numbers — state graphs

## goToNumber

*2 states; 2 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "['$'] → [K]/[S]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
```

## goToNextNumber

*3 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s2["goToNextNumber"]
  idle([idle])
  idle -. enter .-> s2
  s1 -- "['$'] → [K]/[S]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
  s2 -- "[*] → [K]/[R]" --> s1
```

## goToPreviousNumber

*3 states; 3 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s3["goToPreviousNumberInternal"]
  s4["goToPreviousNumber"]
  idle([idle])
  idle -. enter .-> s4
  s3 -- "['$'] → [K]/[S]" --> s0
  s3 -- "[*] → [K]/[L]" --> s3
  s4 -- "[*] → [K]/[L]" --> s3
```

## deleteNumber

*5 states; 6 transitions; 1 wrapper (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s6["deleteNumberInternal"]
  s8["deleteNumber"]
  s7[["goToNumberStart(deleteNumberInternal)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    s5["goToNumberStart"]
    c5(((halt)))
  end
  idle -. enter .-> s8
  s7 == "call" ==> s5
  w_5 -. "return" .-> s7
  s7 --> s6
  s5 -- "['^'] → [K]/[S]" --> c5
  s5 -- "[*] → [K]/[L]" --> s5
  s6 -- "['$'] → [E]/[S]" --> s0
  s6 -- "[*] → [E]/[R]" --> s6
  s8 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> s7
  s8 -- "[*] → [K]/[S]" --> s0
```

## goToNumbersStart

*2 states; 2 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s5["goToNumberStart"]
  idle([idle])
  idle -. enter .-> s5
  s5 -- "['^'] → [K]/[S]" --> s0
  s5 -- "[*] → [K]/[L]" --> s5
```

## invertNumber

*5 states; 8 transitions; 1 wrapper (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s9["invertNumberGoToNumberWithInversion"]
  s11["invertNumber"]
  s10[["goToNumberStart(invertNumberGoToNumberWithInversion)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    s5["goToNumberStart"]
    c5(((halt)))
  end
  idle -. enter .-> s11
  s10 == "call" ==> s5
  w_5 -. "return" .-> s10
  s10 --> s9
  s5 -- "['^'] → [K]/[S]" --> c5
  s5 -- "[*] → [K]/[L]" --> s5
  s9 -- "['^'] → [K]/[R]" --> s9
  s9 -- "['1'] → ['0']/[R]" --> s9
  s9 -- "['0'] → ['1']/[R]" --> s9
  s9 -- "['$'] → [K]/[S]" --> s0
  s11 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> s10
  s11 -- "[*] → [K]/[S]" --> s0
```

## normalizeNumber

*7 states; 9 transitions; 1 wrapper (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  s14[["goToNumberStart(normalizeNumberMoveNumberStart)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    s5["goToNumberStart"]
    c5(((halt)))
  end
  idle -. enter .-> s15
  s14 == "call" ==> s5
  w_5 -. "return" .-> s14
  s14 --> s13
  s1 -- "['$'] → [K]/[S]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
  s5 -- "['^'] → [K]/[S]" --> c5
  s5 -- "[*] → [K]/[L]" --> s5
  s12 -- "[B] → ['^']/[S]" --> s1
  s13 -- "['^']|['0'] → [E]/[R]" --> s13
  s13 -- "['1']|['$'] → [K]/[L]" --> s12
  s15 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> s14
  s15 -- "[*] → [K]/[S]" --> s0
```

## plusOne

*5 states; 10 transitions; has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s16["plusOneFillZeros"]
  s17["plusOneAddNumberStart"]
  s18["plusOneCaryOne"]
  s19["plusOne"]
  idle([idle])
  idle -. enter .-> s19
  s16 -- "['1'] → ['0']/[R]" --> s16
  s16 -- "['$'] → [K]/[S]" --> s0
  s17 -- "[B] → ['^']/[R]" --> s17
  s17 -- "['1'] → [K]/[R]" --> s16
  s18 -- "['0'] → ['1']/[R]" --> s16
  s18 -- "['1'] → [K]/[L]" --> s18
  s18 -- "['^'] → ['1']/[L]" --> s17
  s19 -- "['^']|['1']|['0'] → [K]/[R]" --> s19
  s19 -- "['$'] → [K]/[L]" --> s18
  s19 -- "[*] → [K]/[S]" --> s0
```

## minusOne

*18 states; 28 transitions; 5 wrappers (max nesting depth 3); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s9["invertNumberGoToNumberWithInversion"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  s23["minusOne"]
  s10[["goToNumberStart(invertNumberGoToNumberWithInversion)"]]
  s14[["goToNumberStart(normalizeNumberMoveNumberStart)"]]
  s20[["invertNumber(normalizeNumber)"]]
  s21[["plusOne(invertNumber(normalizeNumber))"]]
  s22[["invertNumber(plusOne(invertNumber(normalizeNumber)))"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    s5["goToNumberStart"]
    c5(((halt)))
  end
  subgraph w_11["callable subtree of invertNumber"]
    s11["invertNumber"]
    c11(((halt)))
  end
  subgraph w_19["callable subtree of plusOne"]
    s16["plusOneFillZeros"]
    s17["plusOneAddNumberStart"]
    s18["plusOneCaryOne"]
    s19["plusOne"]
    c19(((halt)))
  end
  idle -. enter .-> s23
  s10 & s14 == "call" ==> s5
  s20 & s22 == "call" ==> s11
  s21 == "call" ==> s19
  w_5 -. "return" .-> s10 & s14
  w_11 -. "return" .-> s20 & s22
  w_19 -. "return" .-> s21
  s10 --> s9
  s14 --> s13
  s20 --> s15
  s21 --> s20
  s22 --> s21
  s1 -- "['$'] → [K]/[S]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
  s5 -- "['^'] → [K]/[S]" --> c5
  s5 -- "[*] → [K]/[L]" --> s5
  s9 -- "['^'] → [K]/[R]" --> s9
  s9 -- "['1'] → ['0']/[R]" --> s9
  s9 -- "['0'] → ['1']/[R]" --> s9
  s9 -- "['$'] → [K]/[S]" --> s0
  s11 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> s10
  s11 -- "[*] → [K]/[S]" --> c11
  s12 -- "[B] → ['^']/[S]" --> s1
  s13 -- "['^']|['0'] → [E]/[R]" --> s13
  s13 -- "['1']|['$'] → [K]/[L]" --> s12
  s15 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> s14
  s15 -- "[*] → [K]/[S]" --> s0
  s16 -- "['1'] → ['0']/[R]" --> s16
  s16 -- "['$'] → [K]/[S]" --> c19
  s17 -- "[B] → ['^']/[R]" --> s17
  s17 -- "['1'] → [K]/[R]" --> s16
  s18 -- "['0'] → ['1']/[R]" --> s16
  s18 -- "['1'] → [K]/[L]" --> s18
  s18 -- "['^'] → ['1']/[L]" --> s17
  s19 -- "['^']|['1']|['0'] → [K]/[R]" --> s19
  s19 -- "['$'] → [K]/[L]" --> s18
  s19 -- "[*] → [K]/[S]" --> c19
  s23 -- "['^']|['1']|['0'] → [K]/[R]" --> s23
  s23 -- "['$'] → [K]/[S]" --> s22
  s23 -- "[*] → [K]/[S]" --> s0
```

## minusOneFast

*10 states; 15 transitions; 2 wrappers (max nesting depth 1); has cycles*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  s26["minusOneFast"]
  s14[["goToNumberStart(normalizeNumberMoveNumberStart)"]]
  s25[["minusOneFastBorrow(normalizeNumber)"]]
  idle([idle])
  subgraph w_5["callable subtree of goToNumberStart"]
    s5["goToNumberStart"]
    c5(((halt)))
  end
  subgraph w_24["callable subtree of minusOneFastBorrow"]
    s24["minusOneFastBorrow"]
    c24(((halt)))
  end
  idle -. enter .-> s26
  s14 == "call" ==> s5
  s25 == "call" ==> s24
  w_5 -. "return" .-> s14
  w_24 -. "return" .-> s25
  s14 --> s13
  s25 --> s15
  s1 -- "['$'] → [K]/[S]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
  s5 -- "['^'] → [K]/[S]" --> c5
  s5 -- "[*] → [K]/[L]" --> s5
  s12 -- "[B] → ['^']/[S]" --> s1
  s13 -- "['^']|['0'] → [E]/[R]" --> s13
  s13 -- "['1']|['$'] → [K]/[L]" --> s12
  s15 -- "['^']|['1']|['0']|['$'] → [K]/[S]" --> s14
  s15 -- "[*] → [K]/[S]" --> s0
  s24 -- "['1'] → ['0']/[S]" --> c24
  s24 -- "['0'] → ['1']/[L]" --> s24
  s24 -- "['^'] → [K]/[S]" --> c24
  s26 -- "['^']|['1']|['0'] → [K]/[R]" --> s26
  s26 -- "['$'] → [K]/[L]" --> s25
  s26 -- "[*] → [K]/[S]" --> s0
```
