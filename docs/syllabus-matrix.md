# Warmups Syllabus Matrix

## How to read this

This document is governed by one mental model. State this understanding; it governs every entry:

- **PATTERN** (language-agnostic, PRIMARY): the computational move — expressible in C with only arrays, indices, pointers, loops, conditionals, arithmetic. IDENTICAL across Python and JS; only the spelling differs.
- **CAPABILITY** (hash map, set, sort, stack/queue): an algorithmic tool present in every language. Each is BUILT from raw parts (a granular build sub-sequence) AND separately USED as a tool for higher patterns.
- **SUGAR** (enumerate, zip, comprehension, slicing, `.map`/`.reduce`, `Counter`, `sorted(key=)`): language-specific convenience over a pattern; earned AFTER the raw form, and always cross-referenced to the pattern it replaces.

Everything grounds in the raw substrate. Math is covered as PROGRAMMING OPERATIONS, never as number theory.

## Legend

Each unit is a sequence of **entries**, and every entry declares its shape:

- **pattern** — a raw computational move (the primary substrate).
- **capability-build** — the granular sub-sequence that constructs a tool (hash map, set, sort, stack/queue) from raw parts.
- **capability-use** — that same tool wielded as a black box to serve a higher pattern.
- **sugar** — a language feature that replaces a specific raw loop; earned only after the raw form.

Entries are described along these columns: **Goal** (the language-agnostic intent) · **Layer** (pattern / capability-build / capability-use / sugar) · **C-equivalent** (the move in arrays + indices, no library) · **Ladder** (raw → idiomatic, per language) · **Primitives** (what the move supports) · **Watch-outs** (the traps) · **NeetCode** (loose problem anchors). Cross-reference lines (`Cross-ref:` / `↩`) link an entry to the same move elsewhere in the syllabus.

## Table of contents

1. [Unit 1 — Loops & iteration](#unit-1--loops--iteration)
2. [Unit 2 — Indexing & slicing](#unit-2--indexing--slicing)
3. [Unit 3 — Strings](#unit-3--strings)
4. [Unit 4 — Hash maps](#unit-4--hash-maps)
5. [Unit 5 — Sets](#unit-5--sets)
6. [Unit 6 — Sorting](#unit-6--sorting)
7. [Unit 7 — Pointers (single cursor)](#unit-7--pointers-single-cursor)
8. [Unit 8 — Two pointers](#unit-8--two-pointers)
9. [Unit 9 — Sliding window](#unit-9--sliding-window)
10. [Unit 10 — Stack / queue / deque](#unit-10--stack--queue--deque)
11. [Unit 11 — Programming math](#unit-11--programming-math)

---

## Unit 1 — Loops & iteration

> Mental model: every entry below is a PATTERN — a computational move you could write in C with nothing but arrays, indices, loops, and arithmetic. Python and JS differ only in spelling. SUGAR (enumerate, zip, comprehensions, `.map`, `sum`/`any`…) is earned *after* the raw loop and always cross-referenced to the move it hides. Math here = programming operations (running totals, counters), never number theory.

The unit ends with a **fencepost reference** because every pattern below shares the same off-by-one skeleton.

---

### Accumulate (fold to one value)
- **Goal (language-agnostic):** sweep a sequence, carrying one running value updated at each element.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int total = 0;
  for (int i = 0; i < n; i++) total += a[i];
  ```
- **Ladder (raw → convenient):**
  - Python: `total=0` / `for x in a: total+=x` → `sum(a)` → `sum(a, start)` / `math.prod(a)`
  - JavaScript: `let total=0; for (const x of a) total+=x;` → `a.reduce((s,x)=>s+x, 0)`
- **Primitives it supports:** sum, product, running max/min value, string concat/join, boolean fold (any/all), building any single summary.
- **Watch-outs:** initialize the accumulator to the **identity** (0 for sum, 1 for product, `-inf`/`a[0]` for max) — never to `a[0]` *and* also loop from `i=0` (double-counts). Empty input: `sum([])==0` is fine, but `reduce` with no init on `[]` throws in JS.
- **NeetCode (loose):** Running Sum of 1d Array, Maximum Subarray (Kadane), Concatenation of Array.
- **Sugar:** Python `sum`/`math.prod`; JS `.reduce` — earned shortcut for the running-value loop.
- **Cross-ref:** Unit 11's polynomial/rolling hash (`h = h*base + x`, Horner) is this same accumulate with a multiplier folded in; digit-building `h = h*10 + d` is the base-10 instance.

---

### Scan for an extreme (+ its index)
- **Goal (language-agnostic):** find the largest/smallest element, and often *where* it is.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int mi = 0;
  for (int i = 1; i < n; i++)
      if (a[i] > a[mi]) mi = i;   /* a[mi] is the max, mi its index */
  ```
- **Ladder (raw → convenient):**
  - Python: `mi=0` / `for i in range(1,len(a)):` / `  if a[i]>a[mi]: mi=i` → value only `max(a)` → index `max(range(len(a)), key=lambda i: a[i])`
  - JavaScript: `let mi=0; for(let i=1;i<a.length;i++) if(a[i]>a[mi]) mi=i;` → value only `Math.max(...a)`
- **Primitives it supports:** argmax/argmin, min/max value, closest-to-target, best-so-far tracking.
- **Watch-outs:** seed with **index 0** and start the loop at **`i=1`** (seeding with `0`/`-inf` risks wrong answer on all-negative data). Ties: `>` keeps the first max, `>=` keeps the last — decide deliberately. `Math.max(...a)` spread blows the stack for very large arrays.
- **NeetCode (loose):** Maximum Subarray, Best Time to Buy/Sell Stock, Find Peak Element.
- **Sugar:** Python `max(a, key=...)`; JS `Math.max` — hide the compare-and-keep loop; only `max(key=)` recovers the index.

---

### Count matches
- **Goal (language-agnostic):** tally how many elements satisfy a predicate.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int c = 0;
  for (int i = 0; i < n; i++) if (a[i] > 3) c++;
  ```
- **Ladder (raw → convenient):**
  - Python: `c=0` / `for x in a:` / `  if x>3: c+=1` → `sum(1 for x in a if x>3)` → `sum(x>3 for x in a)` (bools are ints)
  - JavaScript: `let c=0; for(const x of a) if(x>3) c++;` → `a.filter(x=>x>3).length`
- **Primitives it supports:** frequency of a condition, count of evens/vowels/duplicates-flag, prefix-count.
- **Watch-outs:** counting an *event between elements* (e.g. ascents) is `n-1` iterations, not `n`. Don't conflate "count matches" with "sum of matches."
- **NeetCode (loose):** Number of Good Pairs, Count Elements With Strictly Smaller and Greater, Kids With the Greatest Number of Candies.
- **Sugar:** Python `sum(pred(x) for x in a)` (True==1); JS `.filter().length`.

---

### Neighbor / adjacent compare `a[i]` vs `a[i-1]`
- **Goal (language-agnostic):** relate each element to the one just before it.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int asc = 0;
  for (int i = 1; i < n; i++)
      if (a[i] > a[i-1]) asc++;   /* number of rises */
  ```
- **Ladder (raw → convenient):**
  - Python: `for i in range(1,len(a)):` / `  if a[i]>a[i-1]: ...` → `for prev,cur in zip(a, a[1:]): ...`
  - JavaScript: `for(let i=1;i<a.length;i++){ if(a[i]>a[i-1]) ... }`
- **Primitives it supports:** is-sorted check, count rises/falls, detect duplicates in sorted data, run-length, first-difference array.
- **Watch-outs:** loop **from `i=1`** (index `i-1` must exist) → there are only `n-1` adjacent pairs. Empty or single-element input: zero pairs, loop body never runs — make sure that's the correct answer.
- **NeetCode (loose):** Is Array Monotonic, Contains Duplicate (sorted variant), Longest Continuous Increasing Subsequence.
- **Sugar:** Python `zip(a, a[1:])` pairs each element with its successor — the idiomatic "adjacent pairs" loop.

---

### Fixed-offset compare `a[i]` vs `a[i+k]`
- **Goal (language-agnostic):** relate each element to the one `k` positions ahead (generalized neighbor compare).
- **Layer:** pattern
- **C-equivalent:**
  ```c
  for (int i = 0; i + k < n; i++)
      use(a[i], a[i+k]);   /* i+k must stay in bounds */
  ```
- **Ladder (raw → convenient):**
  - Python: `for i in range(len(a)-k): use(a[i], a[i+k])` → `zip(a, a[k:])`
  - JavaScript: `for(let i=0;i+k<a.length;i++) use(a[i], a[i+k]);`
- **Primitives it supports:** compare across a gap, k-apart duplicates, fixed-stride sampling, difference-at-lag.
- **Watch-outs:** upper bound is `len(a)-k` (equivalently `i+k<n`); with `k=1` this collapses to the neighbor pattern. If `k>=n` the loop runs **zero** times — verify that's intended. `zip(a, a[k:])` yields exactly `n-k` pairs.
- **NeetCode (loose):** Contains Duplicate II (k-distance), Minimum Difference Between Elements, Check If N and Its Double Exist.
- **Sugar:** Python `zip(a, a[k:])` — the offset-pair loop as one expression.

---

### Transform / map
- **Goal (language-agnostic):** produce a new sequence by applying the same function to each element.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int out[N];
  for (int i = 0; i < n; i++) out[i] = a[i] * a[i];
  ```
- **Ladder (raw → convenient):**
  - Python: `out=[]` / `for x in a: out.append(x*x)` → `[x*x for x in a]` → `list(map(lambda x:x*x, a))`
  - JavaScript: `const out=[]; for(const x of a) out.push(x*x);` → `a.map(x=>x*x)`
- **Primitives it supports:** element-wise math, type conversion (`int`/`str`), field extraction, normalization.
- **Watch-outs:** output length **equals** input length (1-to-1) — that's what distinguishes map from filter. Don't mutate `a` in place while also reading it if order matters. `map` in Python is lazy (wrap in `list`).
- **NeetCode (loose):** Squares of a Sorted Array, Shuffle the Array, Running Sum (as scan+map).
- **Sugar:** Python list-comprehension `[f(x) for x in a]` / `map`; JS `.map` — the canonical transform. Prefer comprehension over `map(lambda…)` in Python.

---

### Filter / select
- **Goal (language-agnostic):** produce a new sequence keeping only elements that pass a predicate.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int out[N], m = 0;
  for (int i = 0; i < n; i++) if (a[i] % 2 == 0) out[m++] = a[i];
  /* m = length of result */
  ```
- **Ladder (raw → convenient):**
  - Python: `out=[]` / `for x in a:` / `  if x%2==0: out.append(x)` → `[x for x in a if x%2==0]` → `list(filter(lambda x:x%2==0, a))`
  - JavaScript: `const out=[]; for(const x of a) if(x%2===0) out.push(x);` → `a.filter(x=>x%2===0)`
- **Primitives it supports:** remove/keep by condition, dedup-with-set, partition, compaction (the C `m++` write-index is the two-pointer seed).
- **Watch-outs:** output length is **≤** input — track a separate write index `m` in C/in-place versions. Filtering in place while iterating forward corrupts indices; iterate backward or build a new array.
- **NeetCode (loose):** Move Zeroes, Remove Element, Remove Duplicates from Sorted Array.
- **Sugar:** Python comprehension `[x for x in a if p(x)]` / `filter`; JS `.filter`.
- **Cross-ref:** the `m++` write-index here IS the write-boundary / in-place compaction move — Unit 7 names and generalizes it (and Unit 8's read/write two-pointer is the same skeleton).

---

### Conditional accumulate
- **Goal (language-agnostic):** fold to one value, but only elements passing a predicate contribute (filter + accumulate fused).
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int s = 0;
  for (int i = 0; i < n; i++) if (a[i] % 2 == 0) s += a[i];
  ```
- **Ladder (raw → convenient):**
  - Python: `s=0` / `for x in a:` / `  if x%2==0: s+=x` → `sum(x for x in a if x%2==0)`
  - JavaScript: `let s=0; for(const x of a) if(x%2===0) s+=x;` → `a.filter(x=>x%2===0).reduce((s,x)=>s+x,0)`
- **Primitives it supports:** sum-of-evens, max among matches, count-and-sum combos, guarded running totals.
- **Watch-outs:** same identity-initialization trap as accumulate; if *no* element matches, you get the identity (0), not an error — confirm that's the desired empty-result. Fusing filter+sum avoids building a throwaway list.
- **NeetCode (loose):** Sum of All Odd Length Subarrays (setup), Sum of Even Numbers After Queries, Find Numbers with Even Number of Digits.
- **Sugar:** Python generator `sum(x for x in a if p(x))` — fuses the two moves without an intermediate list.

---

### Flatten list-of-lists
- **Goal (language-agnostic):** concatenate nested sequences into one flat sequence (nested loop, single output).
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int flat[N], m = 0;
  for (int i = 0; i < rows; i++)
      for (int j = 0; j < len[i]; j++)  /* ragged: len[i] per row */
          flat[m++] = a[i][j];
  ```
- **Ladder (raw → convenient):**
  - Python: `flat=[]` / `for sub in ll:` / `  for x in sub: flat.append(x)` → `[x for sub in ll for x in sub]` → `list(itertools.chain.from_iterable(ll))`
  - JavaScript: `const flat=[]; for(const sub of ll) for(const x of sub) flat.push(x);` → `ll.flat()`
- **Primitives it supports:** merge rows, grid→linear indexing (`idx=i*cols+j`), unpack groups, adjacency-list traversal.
- **Watch-outs:** in the comprehension the loop order is **outer-first, left-to-right** (`for sub … for x …`) — a common reversal bug. Ragged inner lengths: never assume a fixed width. `ll.flat()` only flattens one level (use `flat(Infinity)` for deep).
- **NeetCode (loose):** Flatten a 2D array, Matrix reshape, Merge Intervals (after sort).
- **Sugar:** Python nested comprehension `[x for sub in ll for x in sub]`; JS `.flat()`.

---

### Parallel-iterate two sequences by index / interleave
- **Goal (language-agnostic):** walk two sequences in lockstep, using both `a[i]` and `b[i]` per step (or weave them together).
- **Layer:** pattern
- **C-equivalent:**
  ```c
  for (int i = 0; i < n; i++)      /* n = min(len_a, len_b) */
      pair(a[i], b[i]);
  /* interleave: */
  int out[2*n], m = 0;
  for (int i = 0; i < n; i++) { out[m++] = a[i]; out[m++] = b[i]; }
  ```
- **Ladder (raw → convenient):**
  - Python: `for i in range(len(a)): use(a[i], b[i])` → `for x,y in zip(a,b): use(x,y)`; interleave → `[v for pair in zip(a,b) for v in pair]`
  - JavaScript: `for(let i=0;i<a.length;i++) use(a[i], b[i]);` → `a.map((x,i)=>[x, b[i]])`
- **Primitives it supports:** dot product, element-wise combine, key/value pairing, merge two arrays, compare two sequences position-by-position.
- **Watch-outs:** index-loop uses `range(len(a))` and will **crash** if `b` is shorter; `zip` silently stops at the **shorter** sequence (use `itertools.zip_longest` to pad). Interleave output length is `2n`.
- **NeetCode (loose):** Merge Sorted Array, Find the Difference of Two Arrays, Add Two Numbers (digit-parallel).
- **Sugar:** Python `zip(a,b)` / JS `.entries()` for index+value — the earned shortcut for the index-lockstep loop; `zip` drops the manual `range(len)`.

---

### Fencepost family (the shared off-by-one skeleton)
- **Goal (language-agnostic):** pick the correct loop bounds so you touch each *thing* exactly once — where "thing" may be an element, a gap between elements, or a window.
- **Layer:** pattern
- **C-equivalent (the four canonical bounds):**
  ```c
  for (int i = 0;     i < n;      i++) { }   /* n elements            */
  for (int i = 1;     i < n;      i++) { }   /* n-1 items, skip first */
  for (int i = 0;     i < n-1;    i++) { }   /* n-1 adjacent pairs    */
  for (int i = 0; i <= n-k;       i++) { }   /* n-k+1 windows of k    */
  ```
- **Counting cheat-sheet (memorize):**
  - elements: `range(len(a))` → **n**
  - skip first: `range(1, n)` → **n−1**
  - adjacent pairs (`a[i],a[i+1]`): `range(n-1)` → **n−1**
  - fixed offset `k` (`a[i],a[i+k]`): `range(n-k)` → **n−k**
  - sliding windows of size `k`: `range(n-k+1)` → **n−k+1**  (verify: n=5,k=3 → 3 windows)
  - slice `a[i:j]` has length `j-i` (half-open: `i` included, `j` excluded)
- **Watch-outs:** the master rule — **inclusive count = (last − first) + 1**; that "+1" (or its absence) is the fencepost. Windows: `n-k+1` (NOT `n-k`); pairs: `n-1`. When a formula can go negative (`k>n`), the loop should run **zero** times — Python `range(negative)` is empty (safe), C `i<=n-k` with unsigned `n-k` underflows (bug). Always test with the tiniest inputs: `n=0`, `n=1`, `n=k`.
- **NeetCode (loose):** any sliding-window problem (Max Average Subarray I), Contains Duplicate II, Pascal's Triangle (row lengths).

---

### Sugar reference (attach to the patterns above)
Each is a language feature that *replaces a specific raw loop* — earn it only after writing that loop by hand.

- **`enumerate(a)`** (Py) / **`a.entries()`** (JS): index+value loop. Replaces `for i in range(len(a)): x=a[i]`.
  `for i, x in enumerate(a): ...` → `[(0,'a'),(1,'b')]`. Watch: default start is 0; `enumerate(a, 1)` to start at 1.
- **`zip(a,b)`** (Py) / manual **`.map((x,i)=>…)`** (JS): parallel-iterate. Replaces the `range(len)` lockstep loop. **Stops at the shorter sequence** — silent truncation trap.
- **list comprehension `[f(x) for x in a if p(x)]`** / JS **`.map`+`.filter`**: fuses transform and/or filter. Replaces the `out=[]; for…: out.append` loop. Nested `[… for sub in ll for x in sub]` = flatten.
- **dict comprehension `{k: v for …}`**: builds a map in one pass — `{x: x*x for x in [1,2,3]}` → `{1:1,2:4,3:9}`. (Sets up Unit 4's hash-map capability.)
- **`reversed(a)`** (Py) / **`[...a].reverse()`** (JS): back-to-front loop. Replaces `for i in range(n-1,-1,-1)`. Py `reversed` returns a lazy iterator; JS `.reverse()` **mutates** — copy first (`[...a]`) to avoid clobbering the original.
- **`sum` / `max` / `min`**: the accumulate and extreme-scan patterns as one call. `max(a, key=f)` recovers the argmax the bare `max` loses. Empty input: `sum([])==0`, but `max([])` **raises** (pass `default=`).
- **`any` / `all`** (Py) / **`.some` / `.every`** (JS): boolean fold — count-matches short-circuited to a yes/no. `any(x>8 for x in a)` → `True`. Edge: `any([])==False`, `all([])==True` (vacuous truth) — a classic empty-input surprise.

---

## Unit 2 — Indexing & slicing

Everything here is address arithmetic. An array name is a base pointer; `a[i]` is `*(a+i)`. Slices don't exist in C — you carry a `(pointer, length)` pair and copy by hand. Python/JS slicing is **sugar** over that copy loop. Master the raw index math first; the bracket notation is the reward.

---

### Element access & negative index
- **Goal (language-agnostic):** read/write the element at a logical position, counting from either end.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int first = a[0];
  int last  = a[n-1];      // C has NO negative index; you compute n-1 yourself
  int kth_from_end = a[n-k];
  ```
- **Ladder (raw → convenient):**
  - Python: `a[len(a)-1]` → `a[-1]` ; `a[len(a)-k]` → `a[-k]`
  - JavaScript: `a[a.length-1]` → `a.at(-1)` ; `a[a.length-k]` → `a.at(-k)`
- **Primitives it supports:** last/first element, two-pointer endpoints, ring-buffer indexing (`a[i % n]`), sentinel checks.
- **Watch-outs:** empty array → `a[0]` and `a[-1]` are both invalid (Python raises `IndexError`; JS gives `undefined`, silently). `a[-1]` in **C** reads out of bounds — undefined behavior, not "the last element." In Python `a[-k]` is valid only for `1<=k<=len(a)`; `a[-len(a)]` is the first element, `a[-len(a)-1]` raises.
- **NeetCode (loose):** Two Sum, Valid Palindrome, Remove Duplicates from Sorted Array.
- **Sugar:** Python `a[-1]` / JS `a.at(-1)` — earned shortcut for the `n-1` end-index computation. `a.at()` (unlike `a[...]`) is the only JS form that accepts negatives; plain `a[-1]` is a property lookup that returns `undefined`.

---

### Subrange `[i:j)` — pointer + length in C
- **Goal (language-agnostic):** name the contiguous run of elements from index `i` up to but not including `j`.
- **Layer:** pattern
- **C-equivalent:** no slice type; a subrange is a base pointer plus a count, half-open so length is just the difference:
  ```c
  int *p   = a + i;        // start of the subrange
  int len  = j - i;        // number of elements  (j is EXCLUSIVE)
  for (int t = 0; t < len; t++) use(p[t]);   // p[t] == a[i+t]
  ```
  To *own* a copy you must allocate and memcpy: `int *sub = malloc(len*sizeof(int)); memcpy(sub, a+i, len*sizeof(int));`
- **Ladder (raw → convenient):**
  - Python: manual `sub=[]; for t in range(i,j): sub.append(a[t])` → `sub = a[i:j]`
  - JavaScript: manual `const sub=[]; for(let t=i;t<j;t++) sub.push(a[t])` → `const sub = a.slice(i,j)`
- **Primitives it supports:** prefix/suffix (`a[:j]`, `a[i:]`), split-in-half, "everything except ends", partition regions.
- **Watch-outs:** half-open math — `a[i:j]` has `j-i` elements; `a[i:i]` is empty, not one element. Both `a[i:j]` (Py) and `a.slice(i,j)` (JS) **copy** (shallow) — mutating the slice does not touch the original. Out-of-range bounds are **clamped, not errors**: `a[0:999]` returns the whole list; `a[5:2]` returns `[]` (empty, since start ≥ stop). In C you get no clamping and no bounds check — read past `n` is UB.
- **NeetCode (loose):** Best Time to Buy/Sell Stock, Maximum Subarray, Merge Intervals.
- **Sugar:** Python `a[i:j]` / JS `a.slice(i,j)` — earned shortcut for the allocate-and-copy loop. See the Sugar entry below for the full slice grammar.

---

### Reverse
- **Goal (language-agnostic):** produce the elements in opposite order (in place, or as a new sequence).
- **Layer:** pattern
- **C-equivalent:** two indices walking toward each other, swapping:
  ```c
  int lo = 0, hi = n - 1;
  while (lo < hi) {           // strict <  — middle element (if n odd) stays put
      int tmp = a[lo]; a[lo] = a[hi]; a[hi] = tmp;
      lo++; hi--;
  }
  ```
- **Ladder (raw → convenient):**
  - Python: two-pointer swap loop (above) → in-place `a.reverse()` → copy `a[::-1]` → iterate reversed with `reversed(a)`
  - JavaScript: two-pointer swap loop → in-place `a.reverse()` → copy `[...a].reverse()`
- **Primitives it supports:** palindrome check (compare `a[lo]`/`a[hi]` instead of swapping), reverse-a-substring, rotate-by-reversal, reverse-words.
- **Watch-outs:** in-place vs copy is the trap. Python `a.reverse()` mutates and returns `None`; `a[::-1]` returns a new list and leaves `a` alone. JS `a.reverse()` mutates **and** returns the (same, now-reversed) array — so `const b = a.reverse()` makes `b` and `a` the same reversed array; use `[...a].reverse()` for an independent copy. Loop condition must be `lo < hi` (using `<=` double-swaps the middle back to original).
- **NeetCode (loose):** Reverse String, Reverse Linked List, Valid Palindrome.
- **Sugar:** Python `a[::-1]` — earned shortcut for the reverse-copy loop (negative-step slice; see Sugar entry).
- **Cross-ref:** the two-pointer swap loop here is Unit 8's opposite-ends converge (reverse in place); palindrome reuses it with a compare instead of a swap.

---

### Step / stride
- **Goal (language-agnostic):** visit every k-th element instead of every one.
- **Layer:** pattern
- **C-equivalent:** the loop increment is the stride:
  ```c
  for (int t = 0; t < n; t += k) use(a[t]);   // k >= 1
  ```
- **Ladder (raw → convenient):**
  - Python: `for t in range(0,n,k): use(a[t])` → `a[::k]` (collect every k-th) ; `range(hi,lo,-1)` → `a[::-1]` for backward walk
  - JavaScript: `for(let t=0;t<n;t+=k) use(a[t])` → `a.filter((_,i)=>i%k===0)` (no native strided slice)
- **Primitives it supports:** even/odd index partition, sampling, backward iteration (`step=-1`), skip-list style scans.
- **Watch-outs:** `k` must be nonzero — Python `a[::0]` raises `ValueError`, and `t += 0` is an infinite loop in C. Negative step reverses direction: `a[::-1]` walks high→low. When start/stop are given with a negative step, they read "backwards" (`a[hi:lo:-1]` excludes `lo`), a common off-by-one. JS has no built-in stride slice — the raw index loop or `filter((_,i)=>i%k===0)` is the idiom.
- **NeetCode (loose):** (drilled inside) Reverse String, Rotate Array, String Compression.
- **Sugar:** Python `a[::k]` — earned shortcut for the `range(0,n,k)` loop. JS has none; keep the index loop.

---

### Window `a[i:i+k]` (fixed-size slice)
- **Goal (language-agnostic):** name the contiguous block of exactly `k` elements starting at `i`.
- **Layer:** pattern
- **C-equivalent:** it's just the subrange with `len` fixed at `k`:
  ```c
  int *win = a + i;          // window base
  // valid only while i + k <= n
  for (int t = 0; t < k; t++) use(win[t]);   // win[t] == a[i+t]
  ```
  Sliding one step is pure arithmetic — no copy: advance the base (`i++`), so you drop `a[i]` and gain `a[i+k]`.
- **Ladder (raw → convenient):**
  - Python: `[a[i+t] for t in range(k)]` → `a[i:i+k]`
  - JavaScript: `Array.from({length:k}, (_,t)=>a[i+t])` → `a.slice(i,i+k)`
- **Primitives it supports:** fixed-size sliding window (running sum/max), k-length substring scan, chunking (`a[i:i+k]` for `i` in `range(0,n,k)`).
- **Watch-outs:** the last valid start is `i = n-k`, so the loop bound is `i <= n-k` (equivalently `i+k <= n`) — off-by-one here reads past the end in C or silently returns a **short** slice in Python/JS (`a[n-1:n-1+k]` clamps to length 1, it does **not** error). Efficient sliding recomputes incrementally (`sum += a[i+k]; sum -= a[i]`) — re-summing `a[i:i+k]` each step is O(nk), the classic trap the window pattern exists to avoid.
- **NeetCode (loose):** Maximum Average Subarray, Permutation in String, Longest Substring Without Repeating Characters (variable window variant).
- **Cross-ref:** this fixed-size slice is the substrate for Unit 9's sliding window (the incremental `sum += a[i+k]; sum -= a[i]` is its O(1) update-on-slide).

---

### Overflow-safe midpoint `lo + (hi - lo) // 2`
- **Goal (language-agnostic):** compute the index halfway between `lo` and `hi` without integer overflow.
- **Layer:** pattern
- **C-equivalent:** in fixed-width `int`, `lo + hi` can overflow (UB for signed) when both are near `INT_MAX`; the subtraction form never exceeds `hi`:
  ```c
  int mid = lo + (hi - lo) / 2;   // safe; == (lo+hi)/2 for lo<=hi, but no overflow
  ```
- **Ladder (raw → convenient):**
  - Python: `(lo + hi) // 2` (Python ints are arbitrary precision — no overflow, so this is *fine here*) → `lo + (hi - lo) // 2` (habit that transfers to C/Java)
  - JavaScript: `Math.floor((lo + hi) / 2)` (safe up to 2^53) → `lo + ((hi - lo) >> 1)` (integer, overflow-safe idiom)
- **Primitives it supports:** binary search, bisection, divide-and-conquer split point, merge-sort midpoint.
- **Watch-outs:** the overflow bug is invisible in Python (big ints) and rare in JS (doubles), so it's a *portability habit*, not a Python correctness fix — teach it because it matters the moment the code becomes C/Java. `//` and `>>1` both floor toward the low end; that floor choice determines whether binary search terminates — a `lo = mid` update with a floored mid can infinite-loop when `hi - lo == 1` (mid stays `lo`); use `mid = lo + (hi - lo + 1)/2` (ceil) for that branch. `>>` in JS only works on 32-bit integer indices — safe for array indices, wrong for values above 2^31.
- **NeetCode (loose):** Binary Search, Search in Rotated Sorted Array, Find Minimum in Rotated Sorted Array, Koko Eating Bananas.

---

### Sugar: Python slicing & JS `.slice` (over the raw copy loop)
Every slice below is a **copy loop** the language wrote for you. Always tie the notation back to the index math above.

**Python `a[start:stop:step]`** — all three parts optional; half-open `[start, stop)`; returns a **new** list (shallow copy).
- `a[i:j]` ⇒ subrange copy loop `for t in range(i,j)`.
- `a[:j]` / `a[i:]` / `a[:]` ⇒ prefix / suffix / full copy (`a[:]` is the clone idiom).
- `a[::-1]` ⇒ reverse-copy loop (step −1).
- `a[::k]` ⇒ every-k-th loop `range(0,n,k)`.
- `a[i:i+k]` ⇒ fixed window.
- Bounds are **clamped**, never raise: `a[2:999]` → tail, `a[5:2]` → `[]`. (Contrast: bare index `a[999]` *does* raise.)
- Assignment form `a[i:j] = [...]` splices in place and can change length (`a[1:3] = [9]` shrinks) — no C analog.

**JavaScript `a.slice(start, end)`** — half-open `[start, end)`; returns a new (shallow) array; **accepts negatives** (`a.slice(-2)` = last two, `a.slice(1,-1)` = drop first & last).
- `a.slice(i,j)` ⇒ subrange copy.  `a.slice()` / `[...a]` ⇒ full clone.
- Out-of-range clamps to `[]` (`a.slice(5,2)` → `[]`); no error.
- No `step` argument — for stride use the index loop or `a.filter((_,i)=>i%k===0)`; for reverse use `[...a].reverse()` (note: `.reverse()` mutates, `.slice()` does not, so clone first).
- Don't confuse `slice` (copy, non-mutating) with `splice` (mutates in place, returns removed items) — the near-homograph is a classic bug.

**Cross-language contrast to state every time:** C has **no** slice — a "slice" is a `(pointer, length)` view (no copy) *or* a `malloc`+`memcpy` (copy). Python/JS slices always **copy** (shallowly); mutating a slice never affects the source, but the *elements* (objects) are shared references.

---

## Unit 3 — Strings

> Mental model for this unit: a string is **an array of char codes with a length** (in C, a `char*` ending in `'\0'`). Every "string method" is a loop over that array. Python/JS strings are **immutable**, so any "mutation" really builds a *new* array — this is the one fact that drives the whole unit (esp. "build a string efficiently").

---

### Char-by-char processing
- **Goal (language-agnostic):** visit each character, reading its position and/or its integer code point.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  for (int i = 0; s[i] != '\0'; i++) { int code = s[i]; /* s[i] IS the code */ }
  ```
  In C a `char` already *is* its code; `ord`/`charCodeAt` exist because Python/JS chars are 1-length strings, not ints.
- **Ladder (raw → convenient):**
  - Python: `for i in range(len(s)): c = s[i]` → `for c in s:` → `for i, c in enumerate(s):`
  - JavaScript: `for (let i=0;i<s.length;i++){ const c=s[i]; }` → `for (const c of s)` → `for (const [i,c] of [...s].entries())`
- **Code ↔ char both ways:** Python `ord('a')==97`, `chr(97)=='a'`; JS `'a'.charCodeAt(0)===97`, `String.fromCharCode(97)==='a'`.
- **Primitives it supports:** frequency counting, char-arithmetic (`ord(c)-ord('a')` → 0..25 index), running scans, digit/letter classification.
- **Watch-outs:** index a string, get a **1-char string, not an int** — must call `ord`/`charCodeAt` to do math. `s[len(s)]` is out of bounds; last char is `s[len(s)-1]`. Empty string → loop body never runs (correct, but check your accumulator's initial value). JS iterating with `for..of` is code-point-aware (handles surrogate pairs), `s[i]` is UTF-16-unit-aware — usually irrelevant for ASCII warmups but do not conflate.
- **NeetCode (loose):** Valid Anagram, First Unique Character, Ransom Note.
- **Sugar:** Python `enumerate(s)` / JS `[...s].entries()` — earned shortcut for the index+char loop.

---

### Build a string efficiently (accumulate then join)
- **Goal (language-agnostic):** construct output one char/piece at a time without O(n²) recopying.
- **Layer:** pattern
- **C-equivalent:** write into a fixed buffer, track a write index, terminate with `'\0'`:
  ```c
  char buf[64]; int n = 0;
  for (int i = 0; s[i]; i++) buf[n++] = s[i] - 32;  /* to upper */
  buf[n] = '\0';   /* null terminator makes it a valid string */
  ```
- **Ladder (raw → convenient):**
  - Python: `out = ""; out += c` *(trap: O(n²), each += copies)* → `parts = []; parts.append(c)` then `"".join(parts)` *(idiomatic)* → `"".join(c.upper() for c in s)`
  - JavaScript: `let out=""; out += c` *(engines often optimize via ropes, but don't rely on it)* → `const parts=[]; parts.push(c)` then `parts.join("")` → `[...s].map(c=>c.toUpperCase()).join("")`
- **Primitives it supports:** transform-each-char, filtering chars, decoding/encoding, constructing results in reverse.
- **Watch-outs:** the immutability trap — `s[i] = 'x'` is illegal in both languages (`s = s[:i]+'x'+s[i+1:]` rebuilds). Repeated `+=` in a hot loop is the classic quadratic mistake → prefer list+join. In C, forgetting the `'\0'` or overrunning `buf` is the corresponding bug.
- **NeetCode (loose):** Reverse String, String Compression, Encode and Decode Strings.
- **Sugar:** Python `str.join` / JS `Array.prototype.join` — the "collapse an array of pieces into one string" primitive; f-strings/template literals cover the small-fixed-shape case.

---

### Char-class checks (classify a character)
- **Goal (language-agnostic):** decide whether a char is a digit / letter / alphanumeric via its code range.
- **Layer:** pattern
- **C-equivalent (the classifier IS range arithmetic):**
  ```c
  int is_digit = (c >= '0' && c <= '9');
  int is_alpha = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  ```
- **Ladder (raw → convenient):**
  - Python: `ord('0') <= ord(c) <= ord('9')` → `'0' <= c <= '9'` *(string compare works char-wise)* → `c.isdigit()` / `c.isalnum()` / `c.isalpha()`
  - JavaScript: `c >= '0' && c <= '9'` → `/[0-9]/.test(c)` / `/[a-z0-9]/i.test(c)` (no built-in `isdigit`)
- **Primitives it supports:** input validation, tokenizing, "skip non-alnum" two-pointer scans, digit→value via `ord(c)-ord('0')`.
- **Watch-outs:** Python `str.isdigit()` returns `True` for Unicode digits (e.g. superscripts) and `False` for `""`; `isalnum()` is Unicode-aware too — fine for warmups, surprising later. JS has **no** `isdigit`; people reach for regex or explicit range. `" ".isalnum()` → `False`. For "char to numeric value" always subtract `ord('0')`, don't `int(c)` in a tight loop mentally.
- **NeetCode (loose):** Valid Palindrome, Valid Number, String to Integer (atoi).

---

### Reverse a string
- **Goal (language-agnostic):** produce the characters in opposite order.
- **Layer:** pattern
- **C-equivalent (in-place two-pointer swap):**
  ```c
  for (int i=0, j=len-1; i<j; i++, j--) { char t=r[i]; r[i]=r[j]; r[j]=t; }
  ```
- **Ladder (raw → convenient):**
  - Python: `out=""; for i in range(len(s)-1,-1,-1): out+=s[i]` → `"".join(reversed(s))` → `s[::-1]`
  - JavaScript: `let out=""; for(let i=s.length-1;i>=0;i--) out+=s[i]` → `[...s].reverse().join("")` (no string `.reverse()`; must array-ify first)
- **Primitives it supports:** palindrome setup, reverse-words, reverse in place on a char array (LeetCode "Reverse String" wants O(1) in-place — do the swap, not the slice).
- **Watch-outs:** `s[::-1]` is beautifully terse but allocates a new string — the C/interview point is often "do it in place," which strings can't (immutable) so you convert to a list/array first. Loop bound `range(len(s)-1, -1, -1)` — the `-1` stop is exclusive so index 0 IS included; off-by-one here is the classic slip.
- **NeetCode (loose):** Reverse String, Reverse Words in a String, Reverse Integer.

---

### Palindrome check — compare `s[i]` vs `s[n-1-i]`
- **Goal (language-agnostic):** verify symmetry by walking two pointers inward.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i=0, j=len-1;
  while (i < j) { if (s[i] != s[j]) return 0; i++; j--; }
  return 1;
  ```
- **Ladder (raw → convenient):**
  - Python: two-pointer `while i<j:` loop → `all(s[i]==s[len(s)-1-i] for i in range(len(s)//2))` → `s == s[::-1]` *(clear but allocates + doesn't early-exit)*
  - JavaScript: two-pointer `while(i<j)` loop → `[...s].every((c,i)=>c===s[s.length-1-i])` → `s === [...s].reverse().join("")`
- **Primitives it supports:** mirror comparison, converging two-pointer, "same forwards/backwards" with skips (ignore non-alnum, case-fold).
- **Watch-outs:** loop condition is `i < j` (strict) — with `i <= j` the middle char compares to itself harmlessly but wastes a step; the real bug is `i <= j` combined with side effects. Odd length: middle char is never compared (correct). Empty/one-char string is a palindrome — make sure the loop simply doesn't run. The mirror index is `n-1-i`, not `n-i`.
- **NeetCode (loose):** Valid Palindrome, Valid Palindrome II, Palindromic Substrings.
- **Cross-ref:** this is Unit 8's opposite-ends converge with a compare-and-fail-fast per-step rule.

---

### Substring / index-of (search within a string)
- **Goal (language-agnostic):** find whether/where a pattern occurs, and extract a contiguous slice.
- **Layer:** pattern
- **C-equivalent (naive search = nested scan):**
  ```c
  int find(char *s, char *p) {
    for (int i = 0; s[i]; i++) {
      int k = 0;
      while (p[k] && s[i+k] == p[k]) k++;
      if (p[k] == '\0') return i;      /* matched whole pattern */
    }
    return -1;
  }
  ```
- **Ladder (raw → convenient):**
  - Python: nested-loop scan → `s.find(p)` (returns index or `-1`) / `s.index(p)` (raises) → membership `p in s`; slice `s[i:j]`
  - JavaScript: nested-loop scan → `s.indexOf(p)` (index or `-1`) → `s.includes(p)`; slice `s.slice(i,j)` or `s.substring(i,j)`
- **Primitives it supports:** contains-check, prefix/suffix test, tokenizing by delimiter position, sliding-window setup, extracting fields.
- **Watch-outs:** `find`/`indexOf` return **-1 when absent** (falsy-ish but `-1` is truthy in Python `if` and `!= 0` in JS — check `== -1` explicitly, never `if s.find(p):` which is True at index 0... wait, index 0 is falsy — the real trap: `if s.find(p):` is FALSE for a match at position 0). Slice end index is **exclusive**: `s[1:4]` is chars 1,2,3. Out-of-range slice bounds silently clamp (no error), unlike single indexing. JS `substring` swaps args if start>end; `slice` accepts negatives — pick one and know its quirks.
- **NeetCode (loose):** Implement strStr (Find the Index of First Occurrence), Repeated Substring Pattern, Longest Common Prefix.
- **Sugar:** Python `p in s` / JS `s.includes(p)` — earned shortcut for the "did the search return ≥ 0" check.

---

### Build: `my_split` and `my_join` (from raw parts)
Light capability build — both are just the accumulate-then-emit loop from above, made concrete. Do them by hand once; then you'll trust the builtins.

1. **(W)** Write `my_join(parts, sep)`: `if not parts: return ""`, set `out = parts[0]`, then `for p in parts[1:]: out += sep + p`. Note there are **(len-1) separators**, not `len` — the fencepost. ↩ callback to "build a string" (here `+=` is fine, tiny inputs).
2. **(P)** Predict `my_join([], "-")` and `my_join(["a"], "-")`. → `""` and `"a"` (zero and one fencepost).
3. **(W)** Write `my_split(s, sep)`: carry a `cur = ""` accumulator; `for c in s:` if `c == sep` then `out.append(cur); cur = ""` else `cur += c`; **after the loop `out.append(cur)`** to flush the final field. ↩ this flush-after-loop is the same "don't forget the last piece" as the fencepost in step 1.
4. **(P)** Predict `my_split("a,,b", ",")` and `my_split("", ",")`. → `['a','','b']` (empty field between the two commas is real) and `[""]` (one empty field, not `[]`).
5. **(W)** Convince yourself `my_join(my_split(s, ","), ",") == s` for any `s` without... actually only when `sep` is a single char and you split on every occurrence — a nice round-trip invariant.
6. **Reflect:** this is what `str.split` / `str.join` (and JS `String.split` / `Array.join`) do underneath — a single pass with an accumulator and a trailing flush. The builtins add multi-char separators, limits, and regex, but the skeleton is exactly this.

---

### Sugar recap (earned shortcuts, cross-referenced)
- **`str.split` / `str.join`** ↔ the `my_split`/`my_join` loops above. Python `",".join(xs)` calls join on the *separator*; JS `xs.join(",")` calls it on the *array* — same operation, mirrored receiver.
- **f-strings / template literals** ↔ the "build a string of fixed shape" case: Python `f"hi {name} {1+2}"` and JS `` `hi ${name} ${1+2}` `` both interpolate expressions, replacing manual `"hi " + name + " " + str(1+2)` concatenation. Verified output for both: `hi Tom 3`.
- **Slicing `s[i:j]` / `s.slice(i,j)`** ↔ the substring-extract primitive; end-exclusive, clamps out-of-range.
- **`s[::-1]` / `[...s].reverse().join("")`** ↔ the reverse loop; terse but allocates and can't early-exit — reach for the two-pointer form when the interview wants in-place or short-circuit.

---

## Unit 4 — Hash maps

A hash map turns a *key* into an *array index* so lookup/insert/update are O(1) average instead of O(n) scanning. Everything below grounds in one primitive from Unit 1: **an array you index into**. The build shows how to get from "index by a small integer" to "index by anything."

---

### Build: hash map (from raw parts)

Numbered granular progression. Each step is one move, tagged **P** (predict the output/behavior) or **W** (write it). ↩ marks a spiral callback to an earlier step.

1. **(P)** Given `int count[256] = {0}` and `count[c]++` for each byte `c` of `"aabbbc"`, what is `count['a']`, `count['b']`, `count['c']`? *(Answer: 2, 3, 1.)* — This is a hash map already: the "hash" is the byte value itself.
2. **(W)** Write the C loop: `for (char *p=s; *p; p++) count[(unsigned char)*p]++;`. This is a **direct-address table** — key space is small (0–255) so the key *is* the index. No collisions possible.
3. **(P)** Why does direct-address fail for keys like `1000000007` or the string `"tea"`? *(No array is that big / strings aren't indices.)* We need a function `key -> small index`.
4. **(W)** Write a hash for a string into `SIZE` slots: `unsigned h=0; while(*s) h = h*31 + (unsigned char)*s++; return h % SIZE;`. The `% SIZE` folds an unbounded number back into `[0, SIZE)`.
5. **(P)** ↩ Two different keys can now land in the same slot (a **collision**) — direct-address (step 2) never had this. Why is the tradeoff worth it? *(Table size independent of key space.)*
6. **(W)** Resolve collisions by **chaining**: each slot is a linked list `Node{ key, val, next }`. Insert = hash to slot, walk the list; if key found update, else prepend a new node.
   ```c
   int* find(const char *k){
       unsigned i = hash(k);
       for (Node *p = table[i]; p; p = p->next)
           if (strcmp(p->key, k) == 0) return &p->val;
       return NULL;   // absent
   }
   ```
   Note lookup **compares full keys**, not just the hash — different keys can share a slot.
7. **(P)** ↩ If every key hashes to the same slot, chaining degrades to what? *(A linked list — O(n) lookup.)* So performance depends on chains staying short.
8. **(W)** Track **load factor** `α = count / SIZE`. When `α` exceeds ~0.75, **resize**: allocate a bigger table and **rehash** every existing key (its slot `hash(k) % SIZE` changes when `SIZE` changes). Amortized O(1) insert survives because resizes are rare.
9. **(P)** **Open addressing** is the alternative to chaining: on collision, probe the *next* slot (`(i+1) % SIZE`, linear probing) until an empty one. Predict where `find` stops for an absent key. *(At the first empty slot on the probe path.)*
10. **(P)** ↩ Deletion under open addressing needs a **tombstone** (a "was-here" marker), not a plain empty — otherwise you'd cut a probe chain short and lose later keys. Why doesn't chaining (step 6) have this problem? *(Nodes are unlinked individually; no probe path to break.)*
11. **(W)** Build a **frequency counter** on top of the finished map: for each item, `*find_or_insert(k) += 1` (insert with value 0 if absent, then increment). This is exactly step 2's `count[c]++`, now for *any* key type.
12. **Reflect:** this is what Python `dict` and JS `Object`/`Map` do underneath — hash the key, index an internal array, resolve collisions, resize on load. You never write steps 4–10 again; you call the builtin. Every "use" entry below is step 11's move with a different key and value.

> Cross-ref: the string hash in step 4 (`h = h*31 + c`) is Unit 11's polynomial/Horner hash, which is itself Unit 1's accumulate-with-a-multiplier; the `% SIZE` fold is Unit 11's modulo-as-bucketing.

---

### Frequency count
- **Goal (language-agnostic):** count how many times each distinct key appears.
- **Layer:** capability-use
- **C-equivalent:** small keys → direct-address `int count[256]; count[(unsigned char)c]++;`. Arbitrary keys → the hand-built table's `*find_or_insert(k) += 1`.
- **Ladder (raw → convenient):**
  - Python: `if ch in freq: freq[ch]+=1 else: freq[ch]=1` → `freq[ch]=freq.get(ch,0)+1` → `freq=defaultdict(int); freq[ch]+=1` → `Counter(s)`
  - JavaScript: `if (m.has(ch)) m.set(ch, m.get(ch)+1) else m.set(ch,1)` → `m.set(ch, (m.get(ch)||0)+1)` → `freq[ch]=(freq[ch]||0)+1` (Object)
- **Primitives it supports:** anagram check, majority element, most-frequent, first-unique.
- **Watch-outs:** initializing the missing key (`get(x,0)` / `|| 0`); JS `||` treats a real `0` count as falsy — fine when re-incrementing, but use `?? 0` if `0` is a valid stored value you must not clobber; JS object keys stringify (`obj[1]` and `obj["1"]` collide) — prefer `Map` for non-string keys.
- **NeetCode (loose):** Valid Anagram, Majority Element, Top K Frequent Elements.
- **Sugar:** Python `collections.Counter(s)` builds the whole map in one call (`Counter("aabbbc") → Counter({'b':3,'a':2,'c':1})`); `.most_common(k)` returns top-k. No JS builtin — use `Map`.

---

### Two-sum via complement lookup
- **Goal (language-agnostic):** find two elements summing to `target` in one pass by asking the map "have I already seen my complement?"
- **Layer:** capability-use
- **C-equivalent:** hand-built `int->index` table; for each `x`, `int *j = find(target - x);` if non-NULL return `(*j, i)`, else `insert(x, i)`.
- **Ladder (raw → convenient):**
  - Python: `seen={}` then `if target-x in seen: return (seen[target-x], i)` else `seen[x]=i`
  - JavaScript: `const seen=new Map()` then `if (seen.has(target-x)) return [seen.get(target-x), i]` else `seen.set(nums[i], i)`
- **Primitives it supports:** complement/seen-before lookup, pair-sum, "does a partner exist" scans.
- **Watch-outs:** check the complement **before** inserting the current element, or a value equal to `target/2` matches itself; store the *index*, not just presence, if you must return positions; duplicate values — inserting `seen[x]=i` overwrites the earlier index (fine for two-sum, wrong if you need all pairs).
- **NeetCode (loose):** Two Sum, Two Sum II (compare vs. two-pointer on sorted), Pair with Target Sum.
- **Sugar:** the map replaces the O(n²) nested-loop pattern from Unit 2 — name it explicitly as "hash map trades space to drop the inner loop." (Contrast Unit 8's sort + two-pointer, which trades O(1) space for a sort.)

---

### Group-by into buckets
- **Goal (language-agnostic):** partition items into lists keyed by a derived signature.
- **Layer:** capability-use
- **C-equivalent:** hand-built table whose *value* is a growable array (or list head); `append(find_or_insert(key), item)`.
- **Ladder (raw → convenient):**
  - Python: `groups={}` then `groups.setdefault(key, []).append(w)` → `groups=defaultdict(list); groups[key].append(w)`; result via `list(groups.values())`
  - JavaScript: `if (!m.has(key)) m.set(key, []); m.get(key).push(w);` then `[...m.values()]`
- **Primitives it supports:** group anagrams, bucket by length/parity/label, adjacency lists.
- **Watch-outs:** the key must be **canonical & hashable** — for anagrams use sorted chars (`"".join(sorted(w))` / `[...w].sort().join("")`) so `"eat"` and `"tea"` collide on purpose; a Python `list` key throws (unhashable) — use a `tuple`; don't reuse one shared list object as the default (`setdefault([], ...)` builds a fresh one each miss, which is what you want).
- **NeetCode (loose):** Group Anagrams, Group Shifted Strings.
- **Sugar:** Python `defaultdict(list)` removes the "create bucket if absent" branch; JS has no equivalent — the `if (!m.has)` guard stays.

---

### First-unique / first-non-repeating
- **Goal (language-agnostic):** find the first element that occurs exactly once.
- **Layer:** capability-use
- **C-equivalent:** two passes over `int count[256]`: fill, then scan the input in order returning the first `count[c]==1`.
- **Ladder (raw → convenient):**
  - Python: `cnt=Counter(s)` then `for i,ch in enumerate(s): if cnt[ch]==1: return i` → `return -1`
  - JavaScript: build `cnt` object, then `for (let i=0;i<s.length;i++) if (cnt[s[i]]===1) return i;` → `return -1`
- **Primitives it supports:** first-unique-char, single-number-with-counts, first non-repeated in stream.
- **Watch-outs:** two passes required — a single pass can't know an early char is unique until the end; the **second scan must be over the original order** (iterating the map's key order is insertion order in modern Python/JS but conceptually fragile); return the sentinel (`-1`) for "all repeat / empty."
- **NeetCode (loose):** First Unique Character in a String, Single Number.
- **Sugar:** `Counter` collapses the first pass to one line; still need the ordered second pass.

---

### Value → index map
- **Goal (language-agnostic):** remember *where* each value lives so you can jump to it in O(1).
- **Layer:** capability-use
- **C-equivalent:** hand-built `key->int` table storing the position; the two-sum entry above is a special case.
- **Ladder (raw → convenient):**
  - Python: `pos = {v: i for i, v in enumerate(nums)}` then `pos[x]` (dict comprehension is the sugar; raw is a loop `for i,v in enumerate(nums): pos[v]=i`)
  - JavaScript: `const pos=new Map(); nums.forEach((v,i)=>pos.set(v,i));` then `pos.get(x)`
- **Primitives it supports:** index-of lookups, backreference resolution, "position of parent/prev-occurrence" tables.
- **Watch-outs:** with duplicate values the comprehension/last-write **keeps the last index** — if you need the first, guard `if v not in pos` / `if (!pos.has(v))`; distinguish "value maps to index 0" from "value absent" (in JS, `pos.get(x)` returns `undefined` for absent, and `0` is falsy — test with `.has`).
- **NeetCode (loose):** Two Sum, Isomorphic Strings, Find All Anagrams (window index bookkeeping).
- **Sugar:** Python dict comprehension `{v:i for i,v in enumerate(nums)}` is the earned shortcut for the index+value insert loop — cross-ref `enumerate` (Unit 1).

---

### Seen-set for dedup / membership
- **Goal (language-agnostic):** track "have I encountered this?" — a hash map whose value is just presence.
- **Layer:** capability-use
- **C-equivalent:** the hand-built table used as a set (value bit ignored), or `char seen[256]` for small keys; membership = `find(k) != NULL`.
- **Ladder (raw → convenient):**
  - Python: `seen=set()` then `if x not in seen: seen.add(x); out.append(x)`; contains-duplicate: `len(set(arr)) != len(arr)`
  - JavaScript: `const seen=new Set()` then `if (!seen.has(x)) { seen.add(x); out.push(x); }`; contains-duplicate: `new Set(arr).size !== arr.length`
- **Primitives it supports:** dedup preserving order, contains-duplicate, cycle/visited tracking, "seen-before" one-pass checks.
- **Watch-outs:** a set is a map with no payload — reach for it when you only need yes/no, else you waste the value slot; `len(set(arr))` loses order, so use the explicit loop when output order matters; set membership needs hashable keys (same tuple-not-list rule as group-by).
- **NeetCode (loose):** Contains Duplicate, Longest Consecutive Sequence, Happy Number (visited set).
- **Sugar:** Python `set(arr)` / JS `new Set(arr)` construct-and-dedup in one call; both are the CAPABILITY set built on the same table as `dict`/`Map`. (Fully developed in Unit 5.)

---

**Sugar summary (Unit 4):**
- Python: `dict` (raw), `.get(k, default)` (miss-safe read), `defaultdict(int|list)` (auto-init on miss), `Counter` (frequency map + `.most_common`), dict comprehension (bulk build). Each is a shortcut over the raw `if key in d` insert branch.
- JavaScript: `Object` (string/symbol keys only, keys stringify) vs `Map` (any key type, preserves insertion order, `.size`, real iteration). No `defaultdict`/`Counter` — the "init on miss" guard (`(m.get(k)||0)`, `if(!m.has(k))`) stays explicit. Prefer `Map` whenever keys aren't strings or `0`/`""`/`false` are legitimate values.

---

## Unit 5 — Sets

A **set** answers one question fast: *"have I seen this?"* It is a hash map with keys only (values thrown away). Everything below rides on Unit 4's hash table — a set is that table minus the value slot. Two concrete substrates: a **boolean/bit array** when the universe of possible keys is small and integer-shaped, and a **hash set** when keys are large, sparse, or non-integer.

---

### Build: set (from raw parts)

Light build — leans entirely on the Unit 4 hash-map machinery.

1. **(P)** A set stores *keys with no values*. If you already built a chaining hash map, what is the minimum you delete to make it a set? → the value field of each node. Membership = "did lookup find the bucket entry?"
2. **(W)** **Boolean-array set, tiny universe.** Keys are ints `0..N-1`. `present = [False]*N`. Add: `present[k]=True`. Remove: `present[k]=False`. Contains: `present[k]`. This is a *direct-address set* — no hashing, O(1) exact. ↩ (Unit 4 direct-address table, values dropped.)
3. **(P)** Why can't a boolean array be your set for `{"cat","dog"}` or `{5, 1000000000}`? → no integer index / array too large. That failure is *exactly* why hashing exists. ↩ (Unit 4 hash function.)
4. **(W)** **Hash set via chaining.** Reuse your bucket array. Add(k): hash to bucket, scan chain, insert only if absent (sets reject duplicates — that check IS the set's defining behavior). Contains(k): hash, scan chain, return found. Remove(k): unlink from chain.
5. **(P)** Insert the same key twice — how many chain entries? → one. The "insert only if absent" guard is what makes `add` idempotent.
6. **(W)** **Frequency-based membership shortcut.** If you already have a frequency counter (Unit 4), then `count[k] > 0` is a set membership test. A set is a degenerate counter that only records 0 vs ≥1.
7. **Reflect:** this is what Python `set` / JS `Set` do underneath — a hash table whose payload is just presence. `x in s` is one hash + one short chain walk, amortized O(1). The boolean array is the same idea when keys are dense small ints.

---

### Membership test (is x present?)
- **Goal (language-agnostic):** answer "is this element in the collection?" in O(1) instead of scanning.
- **Layer:** capability-use
- **C-equivalent (boolean-array set):**
  ```c
  // universe 0..N-1
  int present[N] = {0};
  present[k] = 1;          // add
  if (present[x]) { /* found */ }   // O(1) membership
  ```
  (Hash-set version: `hash(x)` then walk that bucket's chain — see Unit 4.)
- **Ladder (raw → convenient):**
  - Python: `x in some_list` (O(n) scan) → build `s = set(some_list)` once → `x in s` (O(1))
  - JavaScript: `arr.includes(x)` (O(n)) → `const s = new Set(arr)` → `s.has(x)` (O(1))
- **Primitives it supports:** dedup, has-duplicate, sliding-window "seen", intersection/difference, visited-tracking.
- **Watch-outs:** building the set is O(n) up front — only wins when you query repeatedly. `in` on a **list** is O(n); on a **set** it's O(1) — pick the right container. JS `Set.has` uses `SameValueZero`: object keys compare by reference, so `{a:1}` ≠ a different `{a:1}`.
- **NeetCode (loose):** Contains Duplicate, Two Sum (seen-set variant), Happy Number.
- **Sugar:** Python `in` / JS `Set.prototype.has` — both O(1) on a set.

---

### Deduplicate a list
- **Goal (language-agnostic):** collapse a sequence to its distinct elements.
- **Layer:** capability-use
- **C-equivalent:**
  ```c
  int out[N], m = 0;
  int present[U] = {0};            // U = key universe
  for (int i = 0; i < n; i++)
      if (!present[a[i]]) { present[a[i]] = 1; out[m++] = a[i]; }
  // out[0..m) = distinct values, first-seen order
  ```
- **Ladder (raw → convenient):**
  - Python: manual `seen=set(); out=[]; for x in a: if x not in seen: seen.add(x); out.append(x)` → **order-preserving** `list(dict.fromkeys(a))` → `set(a)` *if order doesn't matter*
  - JavaScript: manual `seen` loop → **order-preserving** `[...new Set(a)]` (JS Set preserves insertion order) → `new Set(a)` if you just need the set
- **Primitives it supports:** distinct-count, uniqueness cleanup, canonical-form collection.
- **Watch-outs:** `set(a)` / `new Set(a)` **loses original order** in Python (JS Set keeps it, but converting via Set still drops duplicates' positions). Distinct results are unordered in Python — sort if you need determinism. Unhashable elements (lists/dicts in Python) can't go in a set. Example verified: `list(dict.fromkeys([3,1,3,2,1])) == [3,1,2]`; `[...new Set([3,1,3,2,1])] == [3,1,2]`.
- **NeetCode (loose):** Remove Duplicates from Sorted Array, Contains Duplicate.

---

### Has-duplicate (any repeat?)
- **Goal (language-agnostic):** decide whether any element appears more than once.
- **Layer:** capability-use
- **C-equivalent:**
  ```c
  int present[U] = {0};
  for (int i = 0; i < n; i++) {
      if (present[a[i]]) return 1;   // duplicate found
      present[a[i]] = 1;
  }
  return 0;
  ```
- **Ladder (raw → convenient):**
  - Python: early-exit loop with `seen` (best — stops at first repeat) → `len(set(a)) != len(a)` (one-liner, always scans all)
  - JavaScript: early-exit loop with `Set` → `new Set(a).size !== a.length`
- **Primitives it supports:** uniqueness validation, anagram/permutation pre-checks, cycle presence.
- **Watch-outs:** `len(set(a)) != len(a)` builds the whole set even when a dup sits at index 1 — the early-exit loop is asymptotically the same but stops sooner in practice. Empty list / single element → no duplicate (`False`). Verified: `len(set([1,2,1]))!=3 → True`; `new Set([1,2,1]).size!==3 → true`.
- **NeetCode (loose):** Contains Duplicate, Contains Duplicate II, Valid Sudoku.

---

### Set intersection / union / difference
- **Goal (language-agnostic):** combine two collections by shared / all / exclusive membership.
- **Layer:** capability-use
- **C-equivalent (union example, boolean-array):**
  ```c
  int inA[U] = {0}, out[U] = {0};       // out doubles as "in result"
  for (int i = 0; i < na; i++) inA[A[i]] = out[A[i]] = 1;  // union starts with A
  for (int j = 0; j < nb; j++) out[B[j]] = 1;              // add B  -> union
  // intersection: out[x] = inA[x] && inB[x];  difference: inA[x] && !inB[x]
  ```
- **Ladder (raw → convenient):**
  - Python: loop + membership tests → `A & B` (∩), `A | B` (∪), `A - B` (∖), `A ^ B` (symmetric diff). Method forms `A.intersection(B)` accept any iterable, operators require both be sets.
  - JavaScript: `[...A].filter(x => B.has(x))` (∩), `new Set([...A, ...B])` (∪), `[...A].filter(x => !B.has(x))` (∖). (Native `Set.prototype.intersection/union/difference` exist in modern runtimes — Node 22+/ES2024 — but the filter form is the portable raw pattern.)
- **Primitives it supports:** common-elements, exclusive-elements, overlap detection, Jaccard-style comparisons.
- **Watch-outs:** results are **unordered** (Python) — sort for stable output. Operators (`&`,`|`,`-`) demand set operands on both sides; use methods to mix with lists. In JS the filter approach is O(|A|) *if* `B` is a Set (O(1) `has`) — filtering against an **array** silently degrades to O(|A|·|B|). Verified: `{1,2,3}&{2,3,4}={2,3}`, `|={1,2,3,4}`, `-={1}`.
- **NeetCode (loose):** Intersection of Two Arrays, Intersection of Two Arrays II, Jewels and Stones.

---

### Sliding-window "seen" (add / remove membership)
- **Goal (language-agnostic):** maintain the set of elements currently inside a moving window, adding on the right and removing on the left, so you can detect a repeat in O(1).
- **Layer:** capability-use
- **C-equivalent (longest substring without repeating char, ASCII):**
  ```c
  int inWin[256] = {0};
  int l = 0, best = 0;
  for (int r = 0; s[r]; r++) {
      while (inWin[(unsigned char)s[r]]) { inWin[(unsigned char)s[l]] = 0; l++; }
      inWin[(unsigned char)s[r]] = 1;
      int len = r - l + 1;
      if (len > best) best = len;
  }
  // best = longest window with all-distinct chars
  ```
- **Ladder (raw → convenient):**
  - Python: `seen=set()` with `seen.add(s[r])` / `seen.remove(s[l])` as the window slides → (for counts instead of presence, graduate to a `Counter`, Unit 4)
  - JavaScript: `const seen=new Set()` with `seen.add(s[r])` / `seen.delete(s[l])`
- **Primitives it supports:** longest-unique-window, all-distinct-in-window checks, "at most k distinct" (needs a counter, not a bare set), duplicate-within-distance-k.
- **Watch-outs:** the window invariant is *"no duplicates inside"* — you must `remove`/`delete` from the **left** *before* re-adding, or the set never shrinks and the `while` loops forever. `set.remove` throws on a missing key (`discard` doesn't); JS `Set.delete` is safe and returns a boolean. Empty input → answer 0. This pattern only needs presence — the moment you need *how many* of an element are in-window, a set is insufficient; switch to a frequency map. Verified: `longest("abcabcbb")==3`, `longest("bbbbb")==1`, `longest("")==0` in both languages.
- **NeetCode (loose):** Longest Substring Without Repeating Characters, Contains Duplicate II, Longest Consecutive Sequence.
- **Sugar:** Python `set.add`/`.discard` · JS `Set.add`/`.delete` — earned shortcuts for the direct-address `inWin[x]=1 / =0` flag flip.
- **Cross-ref:** this is Unit 9's variable window with a set-valued summary; when you need counts rather than presence, it becomes Unit 9's window count-map.

---

### Sugar: set literals & operations
- **Python:** `{1,2,3}` set literal (note: `{}` is an **empty dict**, not a set — use `set()`); comprehension `{f(x) for x in it}`; operators `&  |  -  ^`; `s.add`, `s.discard`, `s.remove`. Each is convenience over the hand-built hash set of the Build entry. Cross-ref: `x in s` == the O(1) membership pattern; `set(a)` == the dedup pattern.
- **JavaScript:** `new Set(iterable)`; `.add` / `.has` / `.delete` / `.size`; spread `[...set]` to go back to an array; insertion order is preserved (unlike Python). No literal syntax and no built-in operator forms historically — hence the `filter`/spread idioms for intersection/union/difference above (native `.intersection`/`.union`/`.difference` land in ES2024). Cross-ref: `s.has(x)` == O(1) membership; `new Set(arr)` == dedup.

---

## Unit 6 — Sorting

Sorting is the first CAPABILITY where the *build* is the whole point: you meet three algorithm families (quadratic, divide-and-conquer, partition-based) and the ideas of **comparator**, **stability**, and **why O(n log n)**. Then you USE a sorted array as a tool: sort-then-sweep, sort + two-pointer, sort-by-key. Everything is array/index/swap underneath — the language builtins just hide the loops.

---

### Build: sorting (from raw parts)

A granular progression. Tag P = predict output before running, W = write it yourself. ↩ = callback to an earlier rung.

1. **(P)** Swap two array slots with a temp: `t=a[i]; a[i]=a[j]; a[j]=t`. Predict `a` after swapping indices 0 and 3 of `[5,2,4,6]`. This swap is the atom of *every* sort below.
2. **(W)** Find the index of the minimum in `a[i..n-1]` (a running-min scan). ↩ this is the min-scan pattern from Unit 2, now returning an *index* not a value.
3. **(W) Selection sort.** For each `i` from `0..n-1`: min-scan the suffix `a[i..]` (step 2), swap that min into `a[i]` (step 1). After iteration `i`, the prefix `a[0..i]` is sorted and final. `n` passes × up to `n` compares → **O(n²)**, always, even if already sorted. Exactly `n-1` swaps.
   ```
   for i in range(len(a)):
       m=i
       for j in range(i+1,len(a)):
           if a[j]<a[m]: m=j
       a[i],a[m]=a[m],a[i]
   ```
4. **(W) Insertion sort.** Grow a sorted prefix by *inserting* `a[i]` into its place: hold `key=a[i]`, slide every larger element right by one, drop `key` in the gap. **O(n²)** worst, but **O(n)** on nearly-sorted input (inner `while` exits immediately) — that's why it beats selection in practice and is used as the base case inside big library sorts.
   ```
   for i in range(1,len(a)):
       key=a[i]; j=i-1
       while j>=0 and a[j]>key:
           a[j+1]=a[j]; j-=1
       a[j+1]=key
   ```
5. **(P)** Given two *already-sorted* arrays `L`, `R`, walk two indices `i,j` and repeatedly emit the smaller front element. Predict the merge of `[1,4]` and `[2,3]`. ↩ this is the two-pointer walk (Unit 5) over two inputs.
6. **(W) The merge itself**, including the drain: after one side empties, append the rest of the other. Use `<=` (not `<`) when picking the left element to keep **stability** (see below).
   ```
   res=[]; i=j=0
   while i<len(L) and j<len(R):
       if L[i]<=R[j]: res.append(L[i]); i+=1
       else: res.append(R[j]); j+=1
   res.extend(L[i:]); res.extend(R[j:])
   ```
7. **(W) Merge sort.** Split in half, recurse on each half, merge (step 6). Base case: length ≤ 1 is already sorted. `log n` levels of splitting × `O(n)` merge work per level → **O(n log n)**, guaranteed. Costs O(n) extra space.
8. **(P) Why O(n log n)?** Each level of the recursion touches all `n` elements once during merging; halving means there are `log₂ n` levels. `n` per level × `log n` levels = `n log n`. This is the *comparison-sort lower bound* — no comparison sort can beat it in the worst case.
9. **(W) Lomuto partition** (the heart of quicksort): pick `pivot=a[hi]`, keep a boundary `i`; scan `j` across `a[lo..hi-1]`, swapping any element `< pivot` down to `a[i++]`. Finally swap the pivot into `a[i]`. Now everything left of `i` is `< pivot`, everything right is `≥ pivot`, and `a[i]` is in its final sorted position.
   ```
   def partition(a,lo,hi):
       pivot=a[hi]; i=lo
       for j in range(lo,hi):
           if a[j]<pivot:
               a[i],a[j]=a[j],a[i]; i+=1
       a[i],a[hi]=a[hi],a[i]
       return i
   ```
10. **(W) Quicksort.** Partition (step 9), then recurse on the two sides *excluding* the pivot: `quicksort(a,lo,p-1)` and `quicksort(a,p+1,hi)`. Average **O(n log n)**, worst-case **O(n²)** on already-sorted input with a bad pivot (each partition peels off one element). In place, not stable.
11. **Reflect:** this is what `sorted()` / `list.sort()` / `Array.prototype.sort()` do underneath — production sorts are hybrids (Python's Timsort = merge + insertion runs; V8 = Timsort). They give you O(n log n), stability (Python/JS spec-guaranteed), and a **comparator** hook so *you* define "less than."

**Stability** — a sort is stable if equal keys keep their original relative order. Demo (sort pairs by first element only): `sorted([(1,'a'),(2,'b'),(1,'c'),(2,'d')], key=lambda p:p[0])` → `[(1,'a'),(1,'c'),(2,'b'),(2,'d')]`. The `'a'` stays before `'c'`. Merge/insertion are stable; selection/quicksort as written are not. Stability is what lets you sort by a secondary key *first*, then a primary key, to get multi-key ordering for free.

**Comparator** — the pluggable "which comes first?" function. Python favors a **key function** (`key=len`) that maps each element to a sort value; JS uses a **compare function** returning negative / 0 / positive. Both let you sort by something other than the raw value.

---

### Selection / Insertion / Merge / Quicksort
- **Goal (language-agnostic):** put an array in order by repeatedly comparing and moving elements.
- **Layer:** capability-build
- **C-equivalent:** insertion sort and a Lomuto partition — pure arrays, indices, swaps, no library:
  ```c
  void insertion(int a[], int n){
    for(int i=1;i<n;i++){int key=a[i],j=i-1;
      while(j>=0 && a[j]>key){a[j+1]=a[j];j--;} a[j+1]=key;}}
  int partition(int a[], int lo, int hi){
    int pivot=a[hi], i=lo;
    for(int j=lo;j<hi;j++) if(a[j]<pivot){int t=a[i];a[i]=a[j];a[j]=t;i++;}
    int t=a[i];a[i]=a[hi];a[hi]=t; return i;}
  ```
- **Watch-outs:** insertion inner loop needs `j>=0 AND a[j]>key` — swap the order and you index `a[-1]`. Merge must **drain both tails**; forgetting one loses elements. Partition boundary: scan `j` up to `hi-1` (not `hi`, that's the pivot), and the final swap goes to `a[i]`, not `a[i+1]`. Quicksort recurses on `p-1`/`p+1`, never re-including the pivot (infinite loop otherwise). Base cases: length ≤ 1.
- **NeetCode (loose):** Sort an Array, Sort Colors, Kth Largest Element in an Array (quickselect = one-sided quicksort), Merge k Sorted Lists.

---

### Sort-then-sweep
- **Goal (language-agnostic):** sort first so that any relationship between *equal or adjacent* values becomes a neighbor check in one linear pass.
- **Layer:** capability-use
- **C-equivalent:** after sorting `a`, `for(int i=1;i<n;i++) if(a[i]==a[i-1]) return 1;` detects a duplicate — O(n log n) sort + O(n) sweep.
- **Ladder (raw → convenient):**
  - Python: `a=sorted(a); for i in range(1,len(a)): if a[i]==a[i-1]: return True` → (for counting/grouping, a Counter or set is often simpler — cross-ref Unit 4)
  - JavaScript: `a=a.slice().sort((x,y)=>x-y); for(let i=1;i<a.length;i++) if(a[i]===a[i-1]) return true`
- **Primitives it supports:** duplicate detection, grouping equal keys into runs, min-gap between values, merge-overlapping-intervals (sort by start, sweep).
- **Watch-outs:** sorting is O(n log n) — if a hash set answers the same question in O(n), prefer it *unless* you also need order (gaps, intervals). Sort a **copy** if the caller's order matters.
- **NeetCode (loose):** Contains Duplicate, Merge Intervals, Meeting Rooms, Longest Consecutive Sequence (or do it with a set instead).
- **Cross-ref:** the post-sort neighbor check is Unit 1's adjacent-compare `a[i]` vs `a[i-1]`.

---

### Sort + two-pointer
- **Goal (language-agnostic):** sort, then use the monotonicity to converge two indices from the ends, turning an O(n²) pair search into O(n) after the sort.
- **Layer:** capability-use
- **C-equivalent:** on sorted `a`, `i=0,j=n-1; while(i<j){ s=a[i]+a[j]; if(s==t) …; else if(s<t) i++; else j--; }` — sortedness guarantees moving the correct pointer never skips a valid pair.
- **Ladder (raw → convenient):**
  - Python: `a=sorted(a); i,j=0,len(a)-1` then the converging `while i<j` loop. `two_sum_sorted([8,1,3,5],8)` → `(3,5)`.
  - JavaScript: `a.sort((x,y)=>x-y)` then the same index walk.
- **Primitives it supports:** two-sum on sorted input, 3-sum (fix one element + two-pointer the rest), closest pair to target, container/interval overlaps.
- **Watch-outs:** the two-pointer step is only valid *because* the array is sorted — the sort is a precondition, not an optimization you can drop. For 3-sum, skip duplicate values at each pointer to avoid repeat triples. ↩ builds directly on the two-pointer pattern (Unit 8); the only new idea is "sort to create the monotonic order it needs."
- **NeetCode (loose):** Two Sum II (sorted), 3Sum, 3Sum Closest, Container With Most Water.

---

### Sort by key / by tuple (multi-key tiebreak)
- **Goal (language-agnostic):** order by a *derived* value, or by a primary field with secondary tiebreakers.
- **Layer:** capability-use
- **C-equivalent:** `qsort` with a `int cmp(const void*, const void*)` that compares the primary field and, on a tie (`== 0`), falls through to compare the secondary — that fall-through *is* the multi-key rule.
- **Ladder (raw → convenient):**
  - Python: `sorted(data, key=lambda x:x[1])` → **multi-key** `sorted(data, key=lambda x:(x[1],x[0]))` (compares the tuple lexicographically). `sorted([("bob",30),("al",30),("zoe",25)], key=lambda x:(x[1],x[0]))` → `[('zoe',25),('al',30),('bob',30)]` (by age, then name). Descending: `reverse=True`, or negate a numeric key `key=lambda x:-x[1]`.
  - JavaScript: `data.sort((a,b)=>a[1]-b[1] || a[0].localeCompare(b[0]))` — the `||` chain *is* the tiebreak: if the first comparison is `0` (falsy), it evaluates the next.
- **Primitives it supports:** sort by length/frequency/second field, custom orderings, "most frequent then alphabetical," leaderboard ranking.
- **Watch-outs (JS especially):** the **default `Array.sort` is lexicographic**, even on numbers — `[10,2,1,20].sort()` → `[1,10,2,20]`, because it coerces to strings. **Always pass a comparator for numbers:** `.sort((a,b)=>a-b)`. Python has no such trap (it compares by natural type). In JS a comparator must return a *number*; returning a boolean (`a>b`) is a bug. Python tuples need all fields comparable — mixing types raises `TypeError`.
- **NeetCode (loose):** Sort Characters By Frequency, Top K Frequent Words, Largest Number, Merge Intervals.

---

### Sugar: `sorted(key=)` / `.sort()` (Py) · `Array.sort(cmp)` (JS)
- **Python:** `sorted(iterable, key=…, reverse=…)` returns a **new list**; `list.sort(…)` sorts **in place** and returns `None`. Earned shortcut for: write the whole comparison sort by hand once (the Build above), *then* let Timsort do it. `key=` replaces "decorate each element with its sort value" — it's the DSU (decorate-sort-undecorate) pattern collapsed into one argument. Both are **stable**.
- **JavaScript:** `arr.sort(cmp)` sorts **in place and also returns the same array** (`arr.sort(...) === arr` is `true`) — so `.slice()` first if you must preserve the original. `cmp(a,b)` returns `<0` (a first), `0` (keep order), `>0` (b first). Stable since ES2019.
- **Cross-ref:** this is SUGAR over the *comparator* concept built in step 11. The pattern is "define less-than, apply a proven O(n log n) sort." The #1 gotcha across both: **JS's string-coercing default** — never call `.sort()` bare on numbers.

---

## Unit 7 — Pointers (single cursor)

The through-line of this unit: **one index whose next position is decided by logic, not by a fixed `+1` lockstep.** Every `for i in range(n)` you have written so far marched one step per iteration. Here `i` may sit still, jump several slots, or race ahead of a second cursor. The moment advancement becomes conditional, you are writing a pointer walk — even in Python/JS where there is no literal pointer. Almost nothing here has sugar; this is the raw substrate. (Note: the `w++` write-index from Unit 1's filter IS the compaction pattern below — this unit names and generalizes it.)

---

### Manual advance (`while i < n`)
- **Goal (language-agnostic):** Walk an array with an index you increment *yourself*, so you are free to skip or jump instead of stepping once per iteration.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0;
  while (i < n) {
      /* ... decide how far to move ... */
      i++;               /* or i += k, or don't move */
  }
  ```
- **Ladder (raw → convenient):**
  - Python: `i = 0` / `while i < len(a): ... ; i += 1` → (no idiomatic shortcut — `for` can't skip)
  - JavaScript: `let i = 0` / `while (i < a.length) { ...; i++; }` → `for (let i = 0; i < a.length; )` with manual `i++` inside
- **Primitives it supports:** every other pattern in this unit; anything where the step size is data-dependent.
- **Watch-outs:** you own the increment — forget it and you infinite-loop. Always advance `i` on *every* path through the loop body, or guarantee some inner loop does. Empty input: `while 0 < 0` never enters, which is correct.
- **NeetCode (loose):** Remove Element, Move Zeroes, Merge Sorted Array.

---

### Advance by a variable amount / jump ahead
- **Goal (language-agnostic):** Move the cursor forward by an amount computed at runtime (skip `k`, jump to a stored offset) instead of by 1.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0;
  while (i < n) {
      use(a[i]);
      i += step;          /* step may vary each iteration */
  }
  ```
- **Ladder (raw → convenient):**
  - Python: `i = 0` / `while i < len(a): picked.append(a[i]); i += 2` → *sugar:* `a[::2]` slicing (only for a **constant** stride)
  - JavaScript: `let i=0` / `while (i<a.length){ picked.push(a[i]); i+=2; }` → `for (let i=0; i<a.length; i+=2)`
- **Primitives it supports:** stride sampling, chunking, jump-game style hops, skip-`k` decoding.
- **Watch-outs:** if `step` can be `0` you never terminate — assert `step >= 1`. A large jump can overshoot; the `while i < len` guard catches it, but only if you re-check *before* indexing.
- **NeetCode (loose):** Jump Game II, Gas Station.
- **Sugar:** Python `a[start::step]` / JS none direct — earned shortcut *only* for a fixed stride, not data-dependent jumps.

---

### Advance-while-condition (skip a prefix)
- **Goal (language-agnostic):** Slide the cursor forward as long as a predicate holds — e.g. skip leading spaces or zeros.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0;
  while (i < n && a[i] == 0) i++;   /* i now at first non-zero, or n */
  ```
  ```
  skip -> 3 hi        // "   hi": i stops at 3
  ```
- **Ladder (raw → convenient):**
  - Python: `i = 0` / `while i < len(s) and s[i] == ' ': i += 1` → *sugar:* `s.lstrip()` (strings only)
  - JavaScript: `let i=0` / `while (i<s.length && s[i]===' ') i++` → *sugar:* `s.trimStart()`
- **Primitives it supports:** tokenizing, trimming, skipping sentinel runs, finding the first "real" element.
- **Watch-outs:** **short-circuit order matters** — `i < len` must come *before* `a[i] == ...`, or you index out of bounds when the whole array satisfies the predicate. After the loop, `i` may equal `n` (everything was skipped); check before you read `a[i]`.
- **NeetCode (loose):** Valid Palindrome, String to Integer (atoi).

---

### Skip a run of equal elements
- **Goal (language-agnostic):** From position `i`, advance past a maximal block of identical values, landing on the start of the next distinct value.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0;
  while (i < n) {
      int j = i;
      while (j < n && a[j] == a[i]) j++;   /* [i, j) is one run */
      /* run value a[i], length j - i */
      i = j;
  }
  ```
  ```
  runs -> 1:3 2:2 3:1     // on {1,1,1,2,2,3}
  ```
- **Ladder (raw → convenient):**
  - Python: inner `j=i; while j<len(a) and a[j]==a[i]: j+=1; i=j` → *sugar:* `itertools.groupby(a)`
  - JavaScript: inner `let j=i; while(j<a.length && a[j]===a[i]) j++; i=j` → (no builtin; groupby is manual)
- **Primitives it supports:** run-length encode, dedup, counting consecutive duplicates.
- **Watch-outs:** compare against `a[i]` (the anchor), not `a[j-1]` (works too but reads worse). Advance the *outer* cursor to `j`, never `i+1`, or you re-scan the run. Empty array: outer `while` never enters.
- **NeetCode (loose):** Remove Duplicates from Sorted Array, String Compression.

---

### Write-boundary / in-place compaction (`w++` write index)
- **Goal (language-agnostic):** Read every element with `i`; keep a separate `w` marking the next *write* slot, copying survivors forward. `w` ends as the new length.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int w = 0;
  for (int i = 0; i < n; i++)
      if (a[i] != 0) a[w++] = a[i];
  n = w;                       /* logical truncation */
  ```
  ```
  compact -> 3 5 7            // zeros removed from {0,3,0,5,7,0}
  ```
- **Ladder (raw → convenient):**
  - Python: `w=0` / `for i in range(len(a)): if a[i]!=0: a[w]=a[i]; w+=1` / `del a[w:]` → *sugar:* `a = [x for x in a if x != 0]` (this comprehension IS the compaction; the `w++` is hidden inside)
  - JavaScript: `let w=0; for(...) if(a[i]!==0){ a[w]=a[i]; w++; } a.length=w` → *sugar:* `a = a.filter(x => x !== 0)`
- **Primitives it supports:** remove-element, dedup-in-place, partition, move-zeros; the raw engine under `filter`.
- **Watch-outs:** `w <= i` always, so overwriting `a[w]` never clobbers an unread element — that invariant is *why* in-place is safe. Truncate afterward (`del a[w:]` / `a.length = w`) or the tail garbage lingers. Do not advance `w` on rejected elements.
- **NeetCode (loose):** Remove Element, Remove Duplicates from Sorted Array, Move Zeroes.
- **Sugar:** Python comprehension `[x for x in a if p(x)]` / JS `.filter(p)` — the earned shortcut for this exact `w++` loop, from Unit 1.
- **Cross-ref:** this is literally Unit 1's filter write-index `m++`, named and generalized; Unit 8 recasts it as the same-direction read/write two-pointer.

---

### Find-next-occurrence & reposition
- **Goal (language-agnostic):** Scan forward until you hit a target (or a matching condition), then continue *from* there — the cursor's landing spot becomes the new start.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0;
  while (i < n && a[i] != target) i++;
  /* i == index of target, or n if absent */
  ```
  ```
  found at -> 1              // target 5 in {4,5,6,5,7}
  ```
- **Ladder (raw → convenient):**
  - Python: `i=0` / `while i<len(a) and a[i]!=target: i+=1` → *sugar:* `a.index(target)` (raises if absent) / `next((k for k,x in enumerate(a) if x==target), -1)`
  - JavaScript: `let i=0; while(i<a.length && a[i]!==target) i++` → *sugar:* `a.indexOf(target)` (returns `-1` if absent)
- **Primitives it supports:** linear search, splitting on a delimiter, "find then process the rest," partition pivots.
- **Watch-outs:** distinguish *found* (`i < n`) from *ran off the end* (`i == n`) before dereferencing. Same short-circuit rule as skip-prefix. If you loop again to find the *next* one, restart from `i+1`, not `i`, or you re-find the same slot.
- **NeetCode (loose):** Find the Index of the First Occurrence in a String, Find First and Last Position.

---

### Single walk into a second array (merge-style)
- **Goal (language-agnostic):** Two source cursors `i`, `j` over two arrays; each step you emit the smaller and advance *only that one* cursor — a single interleaved pass.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0, j = 0, o = 0;
  while (i < n && j < m)
      out[o++] = (A[i] <= B[j]) ? A[i++] : B[j++];
  while (i < n) out[o++] = A[i++];    /* drain leftovers */
  while (j < m) out[o++] = B[j++];
  ```
  ```
  merge -> 1 2 3 4 5 6       // A={1,3,5}, B={2,4,6}
  ```
- **Ladder (raw → convenient):**
  - Python: dual-`while` as above / `out += A[i:]; out += B[j:]` → *sugar:* `sorted(A + B)` (loses the O(n) merge — only when inputs already sorted does the manual walk win) / `heapq.merge(A, B)`
  - JavaScript: dual-`while` / `while(i<A.length) out.push(A[i++])` → *sugar:* `[...A, ...B].sort((x,y)=>x-y)` (again O(n log n), not the linear merge)
- **Primitives it supports:** merge step of merge-sort, merging intervals, union/intersection of sorted sets.
- **Watch-outs:** use `<=` (not `<`) to keep stability and not drop equal elements. **Don't forget the two drain loops** — the main loop stops when *either* array empties, leaving a tail. Advance exactly one cursor per emit.
- **NeetCode (loose):** Merge Sorted Array, Merge Two Sorted Lists, Merge Intervals.
- **Cross-ref:** this is the merge step built by hand in Unit 6 (merge sort, step 6).

---

### Run-length encode (compose skip-run + emit)
- **Goal (language-agnostic):** Walk once; for each run of equal values, emit the value and its count — skip-a-run with a write step bolted on.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int i = 0;
  while (i < n) {
      int j = i;
      while (j < n && a[j] == a[i]) j++;
      emit(a[i], j - i);      /* value, run length */
      i = j;
  }
  ```
- **Ladder (raw → convenient):**
  - Python: `while i<len(s): j=i; while j<len(s) and s[j]==s[i]: j+=1; res.append(s[i]+str(j-i)); i=j` → *sugar:* `[(k, len(list(g))) for k,g in itertools.groupby(s)]`
  - JavaScript: `while(i<s.length){ let j=i; while(j<s.length && s[j]===s[i]) j++; res += s[i]+(j-i); i=j; }` → (manual; no builtin)
  - Both produce `a3b2c1` from `"aaabbc"`.
- **Primitives it supports:** compression, tallying consecutive events, histogram of streaks.
- **Watch-outs:** emit *after* the inner loop settles `j`, using `j - i` for the count. If the spec wants counts only for runs `> 1` (e.g. LeetCode String Compression), branch on `j - i`. Single trailing element still forms a length-1 run — don't special-case the last iteration.
- **NeetCode (loose):** String Compression, Encode and Decode Strings.

---

### Lead cursor explores ahead while main trails
- **Goal (language-agnostic):** A fast/lead index `i` scans every element; a slow/trailing index `w` marks committed state. They move at different rates — the gap between them carries meaning (how much has been discarded/held).
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int w = 0;                       /* trailing: next slot to fix */
  for (int i = 0; i < n; i++) {    /* lead: scans ahead */
      if (a[i] != 0) {
          int t = a[w]; a[w] = a[i]; a[i] = t;   /* swap forward */
          w++;
      }
  }
  ```
  ```
  moveZeros -> 1 3 12 0 0     // stable, zeros pushed to end
  ```
- **Ladder (raw → convenient):**
  - Python: `w=0` / `for i in range(len(a)): if a[i]!=0: a[w],a[i]=a[i],a[w]; w+=1` → (no sugar — the swap-forward is inherently manual)
  - JavaScript: `let w=0` / `for(let i=0;i<a.length;i++){ if(a[i]!==0){ [a[w],a[i]]=[a[i],a[w]]; w++; } }`
- **Primitives it supports:** move-zeroes, in-place partition (Dutch flag), stable stream filtering, sliding-window setup (the fast/slow generalizes into two-pointer windows next unit).
- **Watch-outs:** this is compaction's cousin — same `w <= i` invariant, but it *swaps* (order-preserving, no truncate) rather than *overwrites*. When `w == i` the swap is a no-op — fine, don't guard against it (though you may skip it as an optimization). Distinct from Unit 8's two-pointers-from-both-ends: here both cursors move the *same* direction, just at different speeds.
- **NeetCode (loose):** Move Zeroes, Sort Colors, Partition Array.

---

**Unit invariant to internalize:** in every pattern above, some index advances *because the data said so*. The recurring safety rule is the bounds-then-value short-circuit (`i < n && cond(a[i])`), and the recurring correctness rule is the `w <= i` write-behind invariant. Master those two and the whole unit is one idea seen from nine angles. This sets up Unit 8, where a *second* cursor stops moving in lockstep too.

---

## Unit 8 — Two pointers

Prereq: Unit 6 (Sorting) — a sorted array is the substrate for most converge patterns. No new data structure here — two pointers is a **loop discipline**: two integer indices moving over one array under a coordination rule. Everything is C-identical; there is no sugar to earn. The whole unit is four coordination shapes.

---

### Opposite ends → converge (lo/hi walk inward)
- **Goal (language-agnostic):** put an index at each end and move them toward each other until they cross, deciding each step which end advances.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int lo = 0, hi = n - 1;
  while (lo < hi) { /* inspect a[lo], a[hi]; advance one or both */ lo++; hi--; }
  ```
- **Ladder (raw → convenient):** no convenience rungs exist — the raw index form IS the idiom in both languages.
  - Python: `lo, hi = 0, len(a)-1` … `while lo < hi:`
  - JavaScript: `let lo=0, hi=a.length-1;` … `while (lo < hi)`
- **Primitives it supports:** reverse in place, palindrome check, pair-sum in sorted array, container-with-most-water, squares of a sorted array.
- **Watch-outs:**
  - Loop guard is `lo < hi`, **not** `lo <= hi`. With `<=` the middle element swaps with itself (reverse) or gets double-counted.
  - `hi` starts at `n-1`, never `n`. Empty array: `hi = -1`, loop never runs — correct, don't special-case it.
  - Single element: `lo==hi`, loop skipped — correct.
  - When both ends contribute (reverse), advance **both**; when only one end "loses" a comparison (pair-sum, water), advance **only that one**.
- **NeetCode (loose):** Valid Palindrome, Two Sum II (sorted), Container With Most Water.
- **Cross-ref:** reverse-in-place and palindrome here are Unit 2 / Unit 3's two-pointer forms.

**Primitive — reverse in place** (advance both every step):
```python
def reverse(a):
    lo, hi = 0, len(a) - 1
    while lo < hi:
        a[lo], a[hi] = a[hi], a[lo]
        lo += 1; hi -= 1
    return a
# reverse([1,2,3,4,5]) -> [5,4,3,2,1];  reverse([]) -> [];  reverse([9]) -> [9]
```
```javascript
function reverse(a){
  let lo = 0, hi = a.length - 1;
  while (lo < hi){ [a[lo], a[hi]] = [a[hi], a[lo]]; lo++; hi--; }
  return a;
}
```
C: `int t=a[lo]; a[lo]=a[hi]; a[hi]=t; lo++; hi--;` — the JS destructuring swap is the same three-move temp swap, just spelled in one line.

**Primitive — palindrome** (compare ends, fail fast):
```python
def is_pal(s):
    lo, hi = 0, len(s) - 1
    while lo < hi:
        if s[lo] != s[hi]: return False
        lo += 1; hi -= 1
    return True
# "racecar"->True, "abca"->False, ""->True, "a"->True
```
```javascript
function isPal(s){
  let lo = 0, hi = s.length - 1;
  while (lo < hi){ if (s[lo] !== s[hi]) return false; lo++; hi--; }
  return true;
}
```

**Primitive — pair-sum in a SORTED array** (the reason two pointers beats a hash map here: O(1) space, and *sortedness* tells you which way to move):
```python
def pair_sum(a, target):        # a is sorted ascending
    lo, hi = 0, len(a) - 1
    while lo < hi:
        s = a[lo] + a[hi]
        if s == target: return (lo, hi)
        elif s < target: lo += 1     # need bigger -> raise the low end
        else:            hi -= 1     # need smaller -> lower the high end
    return None
# pair_sum([1,2,4,7,11,15], 15) -> (2, 4);  pair_sum([1,2,3], 100) -> None
```
```javascript
function pairSum(a, t){
  let lo = 0, hi = a.length - 1;
  while (lo < hi){
    const s = a[lo] + a[hi];
    if (s === t) return [lo, hi];
    else if (s < t) lo++;
    else hi--;
  }
  return null;
}
```
- **Watch-out:** the move direction is only valid because the array is sorted. On unsorted input this pattern is wrong — use a hash map (Unit 4) instead.

**Primitive — container with most water** (area = width × shorter wall; move the shorter wall, since moving the taller can never help):
```python
def max_area(h):
    lo, hi = 0, len(h) - 1
    best = 0
    while lo < hi:
        best = max(best, (hi - lo) * min(h[lo], h[hi]))
        if h[lo] < h[hi]: lo += 1
        else:             hi -= 1
    return best
# max_area([1,8,6,2,5,4,8,3,7]) -> 49
```
```javascript
function maxArea(h){
  let lo = 0, hi = h.length - 1, best = 0;
  while (lo < hi){
    best = Math.max(best, (hi - lo) * Math.min(h[lo], h[hi]));
    if (h[lo] < h[hi]) lo++; else hi--;
  }
  return best;
}
```
- **Watch-out:** width is `hi - lo` (index distance), height is `min` of the two walls. Advancing the taller wall throws away width without any chance of a taller limiting wall — that's why you always move the shorter.

---

### Opposite ends → merge into a third array (fill from one end)
- **Goal (language-agnostic):** read from two converging ends of a sorted input and write results into a separate array, filling it from its far end so the biggest result lands last.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int lo = 0, hi = n - 1;
  for (int i = n - 1; i >= 0; i--) {
      if (bigger_at_lo) { res[i] = f(a[lo]); lo++; }
      else              { res[i] = f(a[hi]); hi--; }
  }
  ```
- **Primitives it supports:** squares of a sorted array, and generally any "merge two sorted runs by picking the extreme each step."
- **Watch-outs:**
  - Fill the output **back-to-front** (`i` from `n-1` down to `0`) when you're picking the *largest* candidate each step; front-to-back when picking the smallest. Getting this backwards silently reverses the result.
  - Compare **magnitudes** (`abs`), not signed values, for the squares problem — the largest square comes from whichever endpoint is farthest from zero, and that's a negative on the left.
  - Here `lo`/`hi` guard is `lo <= hi` implicitly via the `i` counter running exactly `n` times — don't add a second `while lo < hi` guard.

**Primitive — squares of a sorted array:**
```python
def sorted_squares(a):          # a sorted ascending, may contain negatives
    n = len(a)
    res = [0] * n
    lo, hi = 0, n - 1
    for i in range(n - 1, -1, -1):
        if abs(a[lo]) > abs(a[hi]):
            res[i] = a[lo] * a[lo]; lo += 1
        else:
            res[i] = a[hi] * a[hi]; hi -= 1
    return res
# sorted_squares([-4,-1,0,3,10]) -> [0,1,9,16,100]
# sorted_squares([-7,-3,2,3,11]) -> [4,9,9,49,121]
```
```javascript
function sortedSquares(a){
  const n = a.length, res = new Array(n);
  let lo = 0, hi = n - 1;
  for (let i = n - 1; i >= 0; i--){
    if (Math.abs(a[lo]) > Math.abs(a[hi])){ res[i] = a[lo]*a[lo]; lo++; }
    else                                  { res[i] = a[hi]*a[hi]; hi--; }
  }
  return res;
}
```

---

### Same-direction: read pointer + write pointer (in-place compaction)
- **Goal (language-agnostic):** one pointer scans every element (`read`), a second lags behind marking where the next kept element goes (`write`); overwrite in place and return the new length.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int w = 1;                       // first element always kept
  for (int r = 1; r < n; r++)
      if (keep(a[r])) a[w++] = a[r];
  return w;                        // new logical length
  ```
- **Ladder (raw → convenient):** raw two-index form is the idiom in all three languages; there is no built-in in-place compaction. (A Python list-comprehension / JS `.filter` produces a *new* array — a different capability, not in-place, and it doesn't return a boundary index.)
- **Primitives it supports:** remove-duplicates from sorted array, remove-element, move-zeroes, partition/Dutch-flag-style compaction.
- **Watch-outs:**
  - `write` starts at `1` (element 0 is trivially kept) and `read` at `1` too; comparing `a[read]` against `a[write-1]` (the last *kept* value), NOT `a[read-1]`.
  - Everything at/after index `write` on return is stale garbage — the caller must use only `a[:write]`. Return the count, not the mutated tail.
  - Empty input: return `0` before touching `a[0]`.
- **NeetCode (loose):** Remove Duplicates from Sorted Array, Remove Element, Move Zeroes.
- **Cross-ref:** same move as Unit 7's write-boundary / compaction and Unit 1's filter `m++`.

**Primitive — remove duplicates in place (sorted input):**
```python
def remove_dupes(a):
    if not a: return 0
    w = 1
    for r in range(1, len(a)):
        if a[r] != a[w-1]:      # differs from last kept -> keep it
            a[w] = a[r]; w += 1
    return w
b = [0,0,1,1,1,2,2,3,3,4]
k = remove_dupes(b)             # k == 5, b[:k] == [0,1,2,3,4]
```
```javascript
function removeDupes(a){
  if (a.length === 0) return 0;
  let w = 1;
  for (let r = 1; r < a.length; r++){
    if (a[r] !== a[w-1]){ a[w] = a[r]; w++; }
  }
  return w;
}
```

---

### Same-direction: fast/slow (rate-differential traversal)
- **Goal (language-agnostic):** advance two pointers over a linked sequence at different speeds (slow +1, fast +2) so they either meet (cycle) or the fast one hits the end while slow sits at a target offset (midpoint, nth-from-end).
- **Layer:** pattern
- **C-equivalent (list represented as a `next[]` index array, `-1` = null):**
  ```c
  int slow = start, fast = start;
  while (fast != -1 && next[fast] != -1) {
      slow = next[slow];
      fast = next[next[fast]];
      if (slow == fast) return 1;   // cycle
  }
  return 0;
  ```
- **Ladder (raw → convenient):** no convenience form — this is a pointer-chasing discipline, identical everywhere. (Modeled here on an integer `next[]` array so it stays in the array/index substrate; the same code works on real linked-list node pointers.)
- **Primitives it supports:** cycle detection (Floyd), find middle of list, nth-node-from-end (start fast n ahead), cycle-start location.
- **Watch-outs:**
  - Guard **both** `fast` and `fast.next` (here `next[fast]`) before the double hop, or you dereference null. Order matters: check `fast != -1` first (short-circuit).
  - Initialize both at `start`; entering the loop with `slow != fast` is what makes the first `if slow == fast` meaningful (they're only equal initially, which the pre-advance placement avoids).
  - For midpoint, whether `slow` lands on the first-of-two or second-of-two middle depends on whether you start `fast` at `start` or `next[start]` — pick deliberately.
- **NeetCode (loose):** Linked List Cycle, Middle of the Linked List, Remove Nth Node From End.

```python
def has_cycle(nxt, start):      # nxt[i] = next index, -1 = null
    slow = fast = start
    while fast != -1 and nxt[fast] != -1:
        slow = nxt[slow]
        fast = nxt[nxt[fast]]
        if slow == fast: return True
    return False
# 0->1->2->3->1 (cycle):  has_cycle([1,2,3,1], 0) -> True
# 0->1->2->3->null:       has_cycle([1,2,3,-1], 0) -> False
```
```javascript
function hasCycle(nxt, start){
  let slow = start, fast = start;
  while (fast !== -1 && nxt[fast] !== -1){
    slow = nxt[slow];
    fast = nxt[nxt[fast]];
    if (slow === fast) return true;
  }
  return false;
}
```

---

### Fix-one + converge (nesting two-pointer inside a loop)
- **Goal (language-agnostic):** sort, then for each index `i` treat `a[i]` as fixed and run an opposite-ends converge over the remaining suffix — turning an O(n³) triple search into O(n²).
- **Layer:** pattern (composition of *sort* + *opposite-ends converge*)
- **C-equivalent:**
  ```c
  qsort(a, n, sizeof(int), cmp);
  for (int i = 0; i < n; i++) {
      if (i > 0 && a[i] == a[i-1]) continue;      // skip dup fixed value
      int lo = i + 1, hi = n - 1;
      while (lo < hi) {
          int s = a[i] + a[lo] + a[hi];
          if      (s < 0) lo++;
          else if (s > 0) hi--;
          else { /* record triple */ lo++; hi--;
                 while (lo < hi && a[lo] == a[lo-1]) lo++;
                 while (lo < hi && a[hi] == a[hi+1]) hi--; }
      }
  }
  ```
- **Primitives it supports:** 3sum, 3sum-closest, 4sum (fix two, converge two), triangle-count.
- **Watch-outs:**
  - **Three** separate dedup skips: on the fixed `i` (compare `a[i]` vs `a[i-1]`), and after recording a hit on both `lo` and `hi`. Miss any and you emit duplicate triples.
  - Inner window starts at `lo = i+1`, not `0` — never reuse the fixed element or re-scan the left side.
  - The dedup-after-hit skips compare against the *just-consumed* value (`a[lo-1]` after `lo++`, `a[hi+1]` after `hi--`) and must keep the `lo < hi` guard inside the skip loops.
  - Sorting first is mandatory — the whole converge direction logic depends on it.
- **NeetCode (loose):** 3Sum, 3Sum Closest, 4Sum.

```python
def three_sum(a):
    a.sort()
    res, n = [], len(a)
    for i in range(n):
        if i > 0 and a[i] == a[i-1]: continue
        lo, hi = i + 1, n - 1
        while lo < hi:
            s = a[i] + a[lo] + a[hi]
            if s < 0: lo += 1
            elif s > 0: hi -= 1
            else:
                res.append([a[i], a[lo], a[hi]])
                lo += 1; hi -= 1
                while lo < hi and a[lo] == a[lo-1]: lo += 1
                while lo < hi and a[hi] == a[hi+1]: hi -= 1
    return res
# three_sum([-1,0,1,2,-1,-4]) -> [[-1,-1,2], [-1,0,1]]
```
```javascript
function threeSum(a){
  a.sort((x, y) => x - y);                 // numeric sort; default sort is lexicographic!
  const res = [], n = a.length;
  for (let i = 0; i < n; i++){
    if (i > 0 && a[i] === a[i-1]) continue;
    let lo = i + 1, hi = n - 1;
    while (lo < hi){
      const s = a[i] + a[lo] + a[hi];
      if (s < 0) lo++;
      else if (s > 0) hi--;
      else {
        res.push([a[i], a[lo], a[hi]]);
        lo++; hi--;
        while (lo < hi && a[lo] === a[lo-1]) lo++;
        while (lo < hi && a[hi] === a[hi+1]) hi--;
      }
    }
  }
  return res;
}
```
- **Sugar note (JS trap, not a shortcut):** `.sort()` with no comparator sorts by **string** order (`[1,2,10]` → `[1,10,2]`). For any numeric two-pointer setup you MUST pass `(x,y)=>x-y`. Python's `.sort()` is numeric by default — this is the one place the two languages' "same" call diverges. (See Unit 6's sort-by-key watch-outs.)

---

**Unit throughline:** every entry is the same skeleton — two integer cursors over one array, a `while lo < hi` (converge) or `for r` with lagging `w` (same-direction) loop, and a per-step rule that advances one or both. Master the four shapes (converge, merge-fill, read/write compaction, fast/slow) and the primitives are just different per-step rules bolted onto them.

---

## Unit 9 — Sliding window

**Prereqs:** Unit 7 (Pointers — two-index scans, `left`/`right`) and Unit 4 (Hash maps — frequency counter, `.get`-with-default, delete-on-zero). A window is just **two indices into one array plus a running summary** (a sum, or a count-map) that you update incrementally instead of recomputing. Everything here is the pointer pattern with an O(1)-maintained aggregate riding along.

The three mental hooks that govern every entry:
1. **Window = `[left, right]` interval** over the array/string. `right` always advances (the outer loop). `left` only advances to restore validity.
2. **Slide = one add + one remove.** Adding `a[right]` and removing `a[left]` are O(1) each — that's the whole reason the window beats recomputing the range.
3. **Size vs bounds:** window length is `right - left + 1`. Fixed window keys off *size k*; variable window keys off a *validity condition* and lets size float.

---

### Fixed window (sum / max over size k)
- **Goal (language-agnostic):** maintain an aggregate over every contiguous block of exactly `k` elements without recomputing the block.
- **Layer:** pattern
- **C-equivalent:**
```c
int s = 0;                        // prime the first window a[0..k-1]
for (int i = 0; i < k; i++) s += a[i];
int best = s;
for (int i = k; i < n; i++) {      // i = new right edge; i-k = element leaving
    s += a[i] - a[i-k];            // add right, remove left: O(1) slide
    if (s > best) best = s;
}
```
- **Ladder (raw → convenient):**
  - Python: `s=0` then `for i in range(k): s+=nums[i]` → `s = sum(nums[:k])` (slice-prime) → loop `for i in range(k,len(nums)): s += nums[i]-nums[i-k]`
  - JavaScript: `let s=0; for(let i=0;i<k;i++) s+=nums[i]` → prime with a small loop (no clean slice-sum) → `for(let i=k;i<nums.length;i++){ s += nums[i]-nums[i-k]; }`
- **Primitives it supports:** max/min/avg of size-k block, count blocks meeting a threshold, fixed-length anagram check, first-negative-in-window.
- **Watch-outs:** off-by-one on the prime loop (`0..k-1`, not `0..k`); the slide loop starts at `i=k`, not `i=k+1`; the element *leaving* is `i-k`, not `i-k-1`; guard `k > n` (no full window exists) and `k == 0`.
- **NeetCode (loose):** Maximum Average Subarray I, Find All Anagrams in a String, Permutation in String.
- **Sugar:** Python `sum(nums[:k])` primes the window in one expression — earned shortcut for the prime loop; do NOT re-slice inside the main loop (`sum(nums[i:i+k])` re-reads all k elements and destroys the O(n)).
- **Cross-ref:** the fixed block `a[i:i+k]` is Unit 2's window slice; the incremental update is why you never re-slice.

---

### O(1) update-on-slide (add right, remove left)
- **Goal (language-agnostic):** the atomic move underneath every window — advancing the window updates the aggregate by *adding the entering element and removing the leaving one*, never rescanning.
- **Layer:** pattern
- **C-equivalent:**
```c
s += a[right];   // element enters on the right
s -= a[left];    // element leaves on the left
// for a count-map instead of a sum: cnt[a[right]]++;  cnt[a[left]]--;
```
- **Ladder (raw → convenient):**
  - Python: sum: `s += nums[right]` / `s -= nums[left]`  •  count-map: `count[c] = count.get(c,0)+1` / `count[c] -= 1`  → `from collections import defaultdict(int)` lets you write `count[c] += 1` directly.
  - JavaScript: sum: `s += nums[right]` / `s -= nums[left]`  •  count-map: `m.set(c,(m.get(c)||0)+1)` / `m.set(c, m.get(c)-1)` (Map is the reliable choice; plain objects coerce keys to strings and inherit prototype keys).
- **Primitives it supports:** every fixed/variable window aggregate; running sum; running frequency; running distinct-count.
- **Watch-outs:** the add and the remove must be the *inverse* of each other (same operation type); when a count hits 0 in a count-map you often must `del`/`delete` the key so `len(map)` still equals the distinct count (see at-most-k); order matters when both happen in one step — add before you test, remove after.
- **NeetCode (loose):** used by all below; no standalone problem.

---

### Variable window: grow-right / shrink-left
- **Goal (language-agnostic):** find the longest (or shortest) contiguous run satisfying a monotone condition — extend `right` greedily, and while the window is invalid, advance `left` to restore it.
- **Layer:** pattern
- **C-equivalent:** (longest subarray with sum ≤ target, non-negative values)
```c
int left = 0, s = 0, best = 0;
for (int right = 0; right < n; right++) {
    s += a[right];                     // grow right
    while (s > target) { s -= a[left]; left++; }  // shrink left until valid
    int len = right - left + 1;
    if (len > best) best = len;
}
```
- **Ladder (raw → convenient):**
  - Python: `left=0; s=0; best=0` + `for right in range(len(nums)):` with inner `while s>target: s-=nums[left]; left+=1` → `best = max(best, right-left+1)`
  - JavaScript: `let left=0,s=0,best=0` + `for(let right=0;right<nums.length;right++)` with inner `while(s>target){ s-=nums[left]; left++; }` → `best = Math.max(best, right-left+1)`
- **Primitives it supports:** longest-valid / shortest-valid runs, longest-substring-without-repeat, longest run under a sum/product cap.
- **Watch-outs:** `left` uses `while`, not `if`, when one entering element can force *several* removals (a single `if` is only correct when each step invalidates by at most one — e.g. no-repeat). **Monotonicity is a precondition:** shrink-left works because growing can only worsen validity and shrinking can only restore it; with negative numbers "sum ≤ target" is NOT monotone, so the window pattern breaks (use prefix sums instead). "Longest" measures at the *bottom* of the loop after restoring validity; "shortest" measures *inside* the while, before you over-shrink.
- **NeetCode (loose):** Longest Substring Without Repeating Characters, Longest Repeating Character Replacement, Minimum Size Subarray Sum.

---

### Window count-map (frequency inside the window)
- **Layer:** capability-use (uses the hand-built hash map / frequency counter from Unit 4)
- **Goal (language-agnostic):** keep a live frequency table of what's currently inside `[left, right]`, updated by one increment on enter and one decrement (plus delete-on-zero) on leave.
- **C-equivalent:** (longest substring with no repeated char; ASCII → direct-address table, no hashing needed)
```c
int cnt[128] = {0};
int left = 0, best = 0;
for (int right = 0; s[right]; right++) {
    cnt[(int)s[right]]++;                 // enter
    while (cnt[(int)s[right]] > 1) {      // duplicate present → shrink
        cnt[(int)s[left]]--; left++;       // leave
    }
    int len = right - left + 1;
    if (len > best) best = len;
}
```
- **Ladder (raw → convenient):**
  - Python: `count = {}` + `count[c] = count.get(c,0)+1` → `from collections import defaultdict; count = defaultdict(int); count[c] += 1`. Test with `while count[c] > 1:` then `count[s[left]] -= 1; left += 1`.
  - JavaScript: `const count = new Map()` + `count.set(c,(count.get(c)||0)+1)`; shrink with `count.set(s[left], count.get(s[left])-1); left++`.
- **Primitives it supports:** distinct-count in window, "no repeat", anagram/permutation match, char-replacement (window valid when `size - maxFreq ≤ k`).
- **Watch-outs:** with a *char-count array* (`cnt[128]`), `len(map)` isn't available — track distinct separately (increment on 0→1, decrement on 1→0). With a real map, remember delete-on-zero if you rely on `len`/`.size` as the distinct count. When the entering char *is* the offender (no-repeat case), your shrink loop tests that char's own count, so `if` suffices; other conditions need `while`.
- **NeetCode (loose):** Longest Substring Without Repeating Characters, Find All Anagrams in a String, Permutation in String.
- **Sugar:** Python `collections.Counter(t)` builds a whole frequency table in one call — earned shortcut over the `for c in t: count[c]=count.get(c,0)+1` loop; JS has no built-in Counter, so a `Map` fill-loop is the idiom. Python `enumerate(s)` / JS `s.entries()` give `(right, c)` together — earned shortcut for `c = s[right]`.

---

### At-most-k distinct
- **Layer:** capability-use (window count-map)
- **Goal (language-agnostic):** longest window containing at most `k` distinct values — grow right, and while distinct-count exceeds `k`, shrink left, dropping keys whose count reaches 0.
- **C-equivalent:**
```c
int cnt[128] = {0}, distinct = 0, left = 0, best = 0;
for (int right = 0; s[right]; right++) {
    if (cnt[(int)s[right]]++ == 0) distinct++;      // new key entered
    while (distinct > k) {
        if (--cnt[(int)s[left]] == 0) distinct--;   // key fully left
        left++;
    }
    int len = right - left + 1;
    if (len > best) best = len;
}
```
- **Ladder (raw → convenient):**
  - Python: `count = defaultdict(int)`; enter `count[c] += 1`; shrink `while len(count) > k: count[s[left]] -= 1; (del count[s[left]] if 0); left += 1`. Here `len(count)` *is* the distinct count — which is exactly why the delete-on-zero is mandatory.
  - JavaScript: `const count = new Map()`; shrink uses `count.size > k` and `count.delete(lc)` when the value hits 0.
- **Primitives it supports:** at-most-k / exactly-k (= atMost(k) − atMost(k−1)), fruit-into-baskets (k=2), longest-with-≤k-distinct.
- **Watch-outs:** if you skip the delete/`del`-on-zero, `len(count)` / `.size` counts stale zero-entries and the shrink condition never triggers — the classic silent bug. **exactly-k** is not a single window; compute it as `atMost(k) - atMost(k-1)`. Decrement *then* test for zero (`--cnt`), not test-then-decrement.
- **NeetCode (loose):** Longest Substring with At Most K Distinct Characters, Longest Substring with At Most Two Distinct Characters, Fruit Into Baskets, Subarrays with K Different Integers.

---

### Minimum window covering
- **Layer:** capability-use (window count-map)
- **Goal (language-agnostic):** shortest window of `s` that contains all required characters of `t` (with multiplicity) — grow right until the window *covers* `t`, then shrink left as far as still-covering, recording the smallest.
- **C-equivalent:** (sketch; `need[c]` starts as the required count and goes negative for surplus; `missing` = how many required slots still unfilled)
```c
int need[128] = {0};
for (int i = 0; t[i]; i++) need[(int)t[i]]++;
int missing = tlen, left = 0, bestL = 0, bestLen = INT_MAX;
for (int right = 0; s[right]; right++) {
    if (need[(int)s[right]]-- > 0) missing--;        // consumed a needed char
    while (missing == 0) {                            // window covers t → try to shrink
        if (right - left + 1 < bestLen) { bestLen = right - left + 1; bestL = left; }
        if (++need[(int)s[left]] > 0) missing++;      // releasing a needed char breaks cover
        left++;
    }
}
// answer = s[bestL .. bestL+bestLen-1] if bestLen != INT_MAX else ""
```
- **Ladder (raw → convenient):**
  - Python: `need = Counter(t); missing = len(t)`. Enter: `if need[c] > 0: missing -= 1` then `need[c] -= 1`. Shrink while `missing == 0`, recording, then `need[s[left]] += 1; if need[s[left]] > 0: missing += 1; left += 1`. Returns `"BANC"` for `("ADOBECODEBANC","ABC")`.
  - JavaScript: same shape with a `Map`; `if((need.get(c)||0) > 0) missing--`, record via `s.slice(left, right+1)`.
- **Primitives it supports:** minimum-window-substring, smallest range covering a multiset, shortest-subarray-containing-all-targets.
- **Watch-outs:** track `missing` as an integer (needed slots remaining), NOT `all(v<=0)` over the whole map each step — that reintroduces an O(k) scan per slide and kills the complexity. Test-and-decrement order is load-bearing: `if need[c] > 0: missing -= 1` must run *before* `need[c] -= 1` on enter, and on exit increment *first* then test `> 0`. Surplus chars drive counts negative — that's intended, only the crossing of the 0 boundary flips `missing`. Return the substring via saved `(bestL, bestLen)`, not by mutating indices you still need; guard "no valid window" (`bestLen` untouched).
- **NeetCode (loose):** Minimum Window Substring, Minimum Size Subarray Sum, Substring with Concatenation of All Words.

---

### Quick decision guide (how to pick the shape)
- **Fixed size k?** → prime `a[0..k-1]`, then slide `add a[i] / remove a[i-k]`. Aggregate is a sum/max.
- **"Longest … under a condition"?** → grow-right, `while invalid: shrink-left`, measure at loop bottom.
- **"Shortest … covering a condition"?** → grow-right until valid, then `while valid: record + shrink-left`, measure inside.
- **Condition involves distinct/frequency?** → carry a count-map; increment on enter, decrement + delete-on-zero on leave; keep a scalar (`missing` / `distinct`) so each slide stays O(1).
- **Values can be negative, or condition non-monotone?** → sliding window is invalid; fall back to prefix sums + hash map.

---

## Unit 10 — Stack / queue / deque

Everything here is one array plus one or two integer indices. A stack is an array with a `top` index; a queue is an array with `head`/`tail` indices; a deque moves both ends. The "structures" are bookkeeping over a flat buffer — learn the index arithmetic first, then earn the builtins.

---

### Build: stack (from raw parts)

1. **(P)** Array `a[100]` and `int top=0`. `top` = number of items = index of the *next* free slot. What is the top element's index? → `top-1`.
2. **(W)** Push: `a[top]=x; top++` (or `a[top++]=x`). Push 1,2,3 into an empty array; write out `a` and `top`.
3. **(P)** Peek without removing: `a[top-1]`. After pushing 1,2,3, what does peek give? → `3`.
4. **(W)** Pop: `int v=a[--top]`. Decrement *first*, then read. Pop once — what's `v` and `top`? → `3`, `2`.
5. **(P)** ↩ Off-by-one check: is the order `top--` then read, or read `a[top-1]` then `top--`? Show they land the same slot. Both read index `top-1`; `--top` fuses them.
6. **(W)** Empty guard: pop must first check `top>0`, else underflow reads garbage / negative index.
7. **(W)** Full guard: push must check `top<capacity`, else overflow past the array.
8. **Reflect:** this is what Python `list.append`/`list.pop()` and JS `Array.push`/`Array.pop` do underneath — a contiguous buffer with a length counter, plus automatic resize when full.

---

### Build: queue (two indices → circular buffer)

1. **(P)** Naive queue: array + `head`, `tail`, both start 0. Enqueue: `a[tail++]=x`. Dequeue: `return a[head++]`. Count of live items? → `tail-head`.
2. **(W)** Enqueue 10,20; dequeue once. Give the returned value and `head`,`tail`. → `10`, then `head=1,tail=2`.
3. **(P)** ↩ Problem: `head` and `tail` only ever climb. After many ops the front of the array is dead space and `tail` runs off the end. What wastes memory? → the abandoned `[0..head)` prefix.
4. **(W)** Fix = wrap indices modulo capacity: **circular buffer**. Track `head` and `size` (cleaner than `tail`). Enqueue: `a[(head+size)%n]=x; size++`. Dequeue: `v=a[head]; head=(head+1)%n; size--`.
5. **(P)** Why track `size` instead of comparing `head==tail`? Because `head==tail` is ambiguous — it means both *empty* and *full*. `size` disambiguates (alternative: leave one slot empty).
6. **(W)** Empty guard `size>0` on dequeue; full guard `size<n` on enqueue.
7. **Reflect:** this is what `collections.deque` (Python) and a proper ring-buffer queue do underneath — O(1) at both ends with no shifting. Contrast JS `Array.shift`, which is O(n) because it re-indexes every element.

> Cross-ref: the `(head+size)%n` wrap is Unit 11's modulo-as-ring-index (`(i+k) % n`).

---

### Build: deque (both ends)

1. **(P)** A deque is a circular buffer that also pushes/pops at the *front*. Front-pop = the queue dequeue you already have. What's front-*push*? → move `head` backwards: `head=(head-1+n)%n; a[head]=x; size++`.
2. **(W)** Back-push `a[(head+size)%n]=x; size++`; back-pop `size--; v=a[(head+size)%n]`.
3. **Reflect:** this is `collections.deque` with `append`/`appendleft`/`pop`/`popleft` — all four O(1).

---

### Stack — LIFO discipline (capability-use)

- **Goal (language-agnostic):** process items in reverse order of arrival; the most recent unresolved item is always on top.
- **Layer:** capability-use
- **C-equivalent:** `int st[N], top=0; st[top++]=x; /* ... */ int v=st[--top];` — the hand-built stack above.
- **Ladder (raw → convenient):**
  - Python: `st=[]; st.append(x)` / `st.pop()` / peek `st[-1]` — already idiomatic (no rawer form needed).
  - JavaScript: `const st=[]; st.push(x)` / `st.pop()` / peek `st[st.length-1]`.
- **Primitives it supports:** matching/pairing, undo, backtracking, expression eval, "most recent" lookups, DFS.
- **Watch-outs:** peek/pop on empty (`st[-1]` throws `IndexError` in Python; `st.pop()` returns `undefined` in JS — silent bug). Always check emptiness before pop when correctness depends on it.
- **NeetCode (loose):** Valid Parentheses, Min Stack, Evaluate Reverse Polish Notation.
- **Sugar:** Python list `append`/`pop` and JS `push`/`pop` ARE the stack — the earned shortcut for the `a[top++]` / `a[--top]` index dance.

---

### Valid parentheses — match with a stack (capability-use)

- **Goal (language-agnostic):** verify nested brackets are balanced and correctly ordered by pairing each closer with the most recent unmatched opener.
- **Layer:** capability-use
- **C-equivalent:** push openers onto `char st[N]`; on a closer, `if(top==0 || st[--top]!=match(c)) return 0;` end with `return top==0;`.
- **Ladder (raw → convenient):**
  - Python:
    ```python
    def valid(s):
        pairs = {')':'(', ']':'[', '}':'{'}
        st = []
        for c in s:
            if c in pairs:
                if not st or st.pop() != pairs[c]: return False
            else:
                st.append(c)
        return not st
    ```
    `valid("()[]{}")→True`, `valid("([)]")→False`, `valid("(")→False`.
  - JavaScript:
    ```js
    function valid(s){
      const pairs={')':'(',']':'[','}':'{'};
      const st=[];
      for(const c of s){
        if(c in pairs){ if(st.pop()!==pairs[c]) return false; }
        else st.push(c);
      }
      return st.length===0;
    }
    ```
    (JS `st.pop()` on empty returns `undefined`, which safely `!==` any opener — no explicit empty guard needed.)
- **Primitives it supports:** balanced-symbol checks, nesting depth, "close the most recent open thing."
- **Watch-outs:** unmatched *closer* on empty stack (must fail, not crash); leftover openers at end (`not st` / `length===0` catches this — forgetting it passes `"("`); the map lookup direction (closer → expected opener).
- **NeetCode (loose):** Valid Parentheses, Generate Parentheses, Remove Invalid Parentheses.

---

### Monotonic stack — next greater element (capability-use)

- **Goal (language-agnostic):** in one pass, resolve for each element the nearest later element that is greater, by keeping a stack of *indices whose answers are still pending*, in decreasing value order.
- **Layer:** capability-use
- **C-equivalent:**
  ```c
  for(int i=0;i<n;i++){
    while(top>0 && nums[st[top-1]]<nums[i]) res[st[--top]]=nums[i];
    st[top++]=i;
  }
  ```
- **Ladder (raw → convenient):**
  - Python:
    ```python
    def nge(nums):
        res = [-1]*len(nums)
        st = []                       # indices, values decreasing
        for i, x in enumerate(nums):
            while st and nums[st[-1]] < x:
                res[st.pop()] = x
            st.append(i)
        return res
    ```
    `nge([2,1,2,4,3]) → [4, 2, 4, -1, -1]`.
  - JavaScript:
    ```js
    function nge(nums){
      const res=new Array(nums.length).fill(-1), st=[];
      for(let i=0;i<nums.length;i++){
        while(st.length && nums[st[st.length-1]]<nums[i]) res[st.pop()]=nums[i];
        st.push(i);
      }
      return res;
    }
    ```
    `nge([2,1,2,4,3]) → [4,2,4,-1,-1]`.
- **Primitives it supports:** next/previous greater or smaller, stock span, largest rectangle in histogram, temperatures.
- **Watch-outs:** store *indices* not values (you need to write back to `res[popped]`); `<` vs `<=` decides how ties/duplicates resolve; elements still on the stack at the end have no greater element (stay `-1`); each index is pushed and popped once → O(n), not O(n²).
- **NeetCode (loose):** Daily Temperatures, Next Greater Element I, Largest Rectangle in Histogram.
- **Sugar:** `enumerate` (Py) / `.entries()` (JS) gives the index+value pair — the earned shortcut for the `i`/`nums[i]` index loop.

---

### Queue — FIFO / BFS frontier (capability-use)

- **Goal (language-agnostic):** process items in arrival order; used as the frontier that makes BFS explore level by level (nearest first).
- **Layer:** capability-use
- **C-equivalent:** the circular buffer above: `q[(head+size)%n]=x; size++;` to enqueue a neighbor, `v=q[head]; head=(head+1)%n; size--;` to expand.
- **Ladder (raw → convenient):**
  - Python:
    ```python
    from collections import deque
    q = deque([start]); seen = {start}
    while q:
        node = q.popleft()          # dequeue front, O(1)
        for nb in neighbors(node):
            if nb not in seen:
                seen.add(nb); q.append(nb)
    ```
    Raw-but-wrong alternative to *avoid*: `list` + `.pop(0)` — correct output but O(n) per dequeue.
  - JavaScript:
    ```js
    // teaching form: array + head pointer (avoids O(n) shift)
    const q=[start]; let head=0; const seen=new Set([start]);
    while(head<q.length){
      const node=q[head++];
      for(const nb of neighbors(node))
        if(!seen.has(nb)){ seen.add(nb); q.push(nb); }
    }
    ```
    Convenience `q.shift()` reads clean but is O(n); the head-index form is the O(1) idiom.
- **Primitives it supports:** BFS shortest path on unweighted graphs/grids, level-order traversal, flood fill, topological sort (Kahn), multi-source BFS.
- **Watch-outs:** mark `seen` at *enqueue* time, not dequeue, or nodes get queued multiple times; process one full level with `for _ in range(len(q))` when you need per-level distance; Python `list.pop(0)` and JS `Array.shift` are O(n) — use `deque.popleft` / a head index.
- **NeetCode (loose):** Number of Islands, Rotting Oranges, Walls and Gates, Course Schedule.
- **Sugar:** `collections.deque` (Py) is the earned FIFO queue — O(1) `popleft`, replacing the manual `head`/`size` ring buffer.

---

### Sliding-window maximum — monotonic deque (capability-use)

- **Goal (language-agnostic):** report the maximum of every length-`k` window in one pass, keeping a deque of *candidate indices* whose values decrease front→back, so the front is always the current window's max.
- **Layer:** capability-use
- **C-equivalent:** ring-buffer deque of indices; back-pop while `nums[back] <= nums[i]`, back-push `i`, front-pop if `front <= i-k`, record `nums[front]` once `i>=k-1`.
- **Ladder (raw → convenient):**
  - Python:
    ```python
    from collections import deque
    def maxwin(nums, k):
        d = deque()                       # indices, values decreasing
        out = []
        for i, x in enumerate(nums):
            while d and nums[d[-1]] <= x: d.pop()       # back: drop dominated
            d.append(i)
            if d[0] <= i - k: d.popleft()               # front: drop expired
            if i >= k - 1: out.append(nums[d[0]])
        return out
    ```
    `maxwin([1,3,-1,-3,5,3,6,7], 3) → [3, 3, 5, 5, 6, 7]`.
  - JavaScript:
    ```js
    function maxwin(nums, k){
      const d=[], out=[];               // indices
      for(let i=0;i<nums.length;i++){
        while(d.length && nums[d[d.length-1]]<=nums[i]) d.pop();
        d.push(i);
        if(d[0]<=i-k) d.shift();
        if(i>=k-1) out.push(nums[d[0]]);
      }
      return out;
    }
    ```
    `maxwin([1,3,-1,-3,5,3,6,7], 3) → [3,3,5,5,6,7]`.
- **Primitives it supports:** window max/min in O(n), "hardest" problem that needs *both* ends, prunes a sorted candidate list without re-scanning.
- **Watch-outs:** store indices (needed to expire the front by position); `<=` vs `<` on the back pop (with `<=` equal-valued dominated candidates are dropped — safe); expire the front *before* recording; only record once the window is full (`i>=k-1`); each index enters and leaves once → O(n).
- **NeetCode (loose):** Sliding Window Maximum, Shortest Subarray with Sum at Least K.
- **Sugar:** `collections.deque` — its O(1) `append`/`pop`/`appendleft`/`popleft` are exactly the two-ended ring buffer; JS reuses a plain array (`push`/`pop` at back, `shift` at front — `shift` is O(n) but total work stays O(n) since each index shifts at most once).
- **Cross-ref:** this is Unit 9's fixed window with a max aggregate that a bare sum can't maintain — the deque is the O(1) update-on-slide for max.

---

### Sugar recap (cross-references)
- Python `list.append`/`.pop()` → **stack** push/pop (`a[top++]` / `a[--top]`).
- Python `list.pop(0)` → queue dequeue, but **O(n)** — prefer `deque.popleft`.
- `collections.deque` → **queue/deque** ring buffer: `append`, `appendleft`, `pop`, `popleft`, all O(1).
- JS `Array.push`/`.pop()` → **stack** (O(1) both).
- JS `Array.shift`/`.unshift` → front ops, but **O(n)** (re-indexes the array) — for queues use a head-index pointer or a real deque structure.

---

## Unit 11 — Programming math

Math here is a set of **programming operations** on integers, not number theory. Every entry is a computational move over arrays/indices/registers. Two cross-cutting threads: **modulo** feeds wrap-around indexing and hashing (Unit 4's hash-map build); **polynomial hash** is literally *accumulate-with-a-multiplier* (Horner, Unit 1's accumulate) and is the string hash used underneath that build.

---

### Modulo as a programming operation
- **Goal (language-agnostic):** map an unbounded integer into a fixed range `[0, m)` — for wrap-around indices, hash buckets, parity, last digit, and bucketing.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int next = (i + k) % n;     // wrap an index forward
  int bucket = key % m;       // hash into m buckets (key >= 0)
  int isOdd = x & 1;          // parity, faster than x % 2
  ```
- **Ladder (raw → convenient):**
  - Python: `(i + k) % n` → `x % 2` for parity → `x & 1` (bit form, below)
  - JavaScript: `(i + k) % n` → `x % 2` → `x & 1`
- **Primitives it supports:** circular buffer / ring index, hash bucketing `h % m`, parity split, last-digit `n % 10`, bucketing into groups, clock/wrap arithmetic.
- **Watch-outs — THE trap of this unit:** sign of `%` on a **negative left operand differs by language.**
  - Python: result takes the **divisor's** sign → always `≥ 0` for positive `m`. `-7 % 3 == 2`.
  - C / JavaScript: result takes the **dividend's** sign (truncated division) → can be **negative**. `-7 % 3 == -1`.
  - So for a **safe non-negative bucket/wrap index** in C/JS you must write `((x % m) + m) % m`. In Python `x % m` already suffices. This bites hardest on wrap-*backward* indexing: Python `(i - 1) % n` wraps correctly; JS needs `((i - 1) % n + n) % n`.
- **NeetCode (loose):** Happy Number, Plus One, Design Circular Queue, Rotate Array.
- **Sugar:** none — `%` is already primitive; `x & 1` is the earned bit shortcut for `x % 2`.
- **Cross-ref:** `h % m` is the bucket step in Unit 4's hash-map build; `(i+k) % n` is the ring-buffer index behind Unit 10's queue.

---

### Integer division & divmod (digit extraction)
- **Goal (language-agnostic):** get the quotient without the fraction — to peel digits, find midpoints, and do floor/ceil.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int n = 1234;
  while (n) { int d = n % 10; n /= 10; }   // pull digits low→high: 4 3 2 1
  int mid = lo + (hi - lo) / 2;            // overflow-safe midpoint
  ```
- **Ladder (raw → convenient):**
  - Python: `n // 10` and `n % 10` → `divmod(n, 10)` returns `(q, r)` in one call → `q, r = divmod(n, 10)`. Verified: `divmod(17, 5) == (3, 2)`.
  - JavaScript: `Math.trunc(n / 10)` (truncates toward zero) with `n % 10`; use `Math.floor` when you specifically want floor. No `divmod` — compute both.
- **Primitives it supports:** reverse-a-number digit loop, sum/count of digits, base conversion, binary-search midpoint, splitting a flat index into `(row, col)` = `divmod(idx, cols)`.
- **Watch-outs:**
  - **Floor vs truncate on negatives.** Python `//` **floors**: `-7 // 2 == -4`. C `/` and JS `Math.trunc` **truncate toward zero**: `-7 / 2 == -3`. They agree only for non-negative operands.
  - **Ceiling division** without floats: Python `-(-a // b)` or `(a + b - 1) // b` (for `a,b > 0`); JS `Math.ceil(a / b)`. Verified `-(-7 // 2) == 4`.
  - Midpoint: prefer `lo + (hi - lo) // 2` over `(lo + hi) // 2` to dodge overflow (a real trap in C/fixed-width; harmless but good habit in Python).
- **NeetCode (loose):** Reverse Integer, Palindrome Number, Add Digits, Binary Search.
- **Sugar:** Python `divmod` — earned shortcut for the paired `//` + `%` you'd otherwise write twice.
- **Cross-ref:** the overflow-safe midpoint is Unit 2's `lo + (hi - lo) // 2`.

---

### Polynomial / rolling hash (Horner)
- **Goal (language-agnostic):** fold a sequence into one integer by `h = h * base + x` — accumulate-with-a-multiplier.
- **Layer:** pattern (this is the **capability-USE** of accumulate that powers Unit 4's hash-map build string hash)
- **C-equivalent:**
  ```c
  unsigned h = 0;
  for (char *s = "abc"; *s; s++) h = h * 31 + *s;   // Horner, one pass
  // reduce into a table of m buckets:  bucket = h % m;
  ```
- **Ladder (raw → convenient):**
  - Python: `h = 0` then loop `h = h * 31 + ord(ch)` → same with `% M` inside loop to bound it. Verified: `"abc"` → `96354`.
  - JavaScript: `h = 0` then `h = h * 31 + ch.charCodeAt(0)` → keep `h = (h * 31 + c) % M` to stay in safe integer range. Verified: `"abc"` → `96354`.
- **Primitives it supports:** string hashing (feeds the Hash-map build), rolling hash for substring search (Rabin–Karp: add new char, subtract `oldest * base^(k-1)`), base-N number parsing (`h = h*10 + digit` is Horner with base 10), evaluating a polynomial at a point.
- **Watch-outs:**
  - This is the **same shape as digit-building** (`h*10 + digit`) — base 10 is just Horner. Point learner back to accumulate.
  - Overflow: C/`unsigned` wraps (intentional, defines the hash); JS loses precision past 2^53, so reduce `% M` **every step**, not once at the end. Python ints are unbounded but reduce anyway to keep buckets small.
  - Rolling window: removing the leading char needs `base^(k-1)` precomputed; the wrap-`%` sign trap applies when you subtract, so re-normalize with `((v % M) + M) % M`.
- **NeetCode (loose):** Repeated DNA Sequences, Longest Duplicate Substring, Find the Index of the First Occurrence in a String, String to Integer (atoi).
- **Sugar:** none idiomatic — the raw fold *is* the idiom; only after this is `hash()`/a hash-map builtin "earned."
- **Cross-ref:** `h = h*base + x` is exactly Unit 1's accumulate with a multiplier folded in; it produces the string key hashed in Unit 4's build.

---

### GCD (Euclid loop)
- **Goal (language-agnostic):** greatest common divisor by repeated remainder until one operand hits zero.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int a = 48, b = 18;
  while (b) { int t = a % b; a = b; b = t; }   // a is the gcd -> 6
  ```
- **Ladder (raw → convenient):**
  - Python: `while b: a, b = b, a % b` (tuple swap needs no temp) → `math.gcd(a, b)`. Both give `gcd(48,18) == 6`.
  - JavaScript: `while (b) { [a, b] = [b, a % b]; }` → no stdlib gcd; keep the loop (`BigInt` version identical for huge values).
- **Primitives it supports:** reduce-a-fraction, LCM via `a // gcd(a,b) * b`, "is coprime" check, grid/step problems (walkable cells, GCD of gaps).
- **Watch-outs:**
  - Loop terminates because remainders strictly shrink; `gcd(x, 0) == x`, and `gcd(0, 0) == 0` (define it if inputs can be zero).
  - The Python/JS parallel swap avoids the C temp — same move, different spelling. Don't write `a = b; b = a % b` (uses the already-overwritten `a`).
  - For negatives, take `abs` first if you want a non-negative gcd (Python `math.gcd` already returns non-negative).
- **NeetCode (loose):** GCD of Strings, Fraction Addition and Subtraction, Water and Jug Problem.
- **Sugar:** Python `math.gcd` (and `math.lcm`) — earned shortcut once the Euclid loop is understood.

---

### Min / max / clamp / abs
- **Goal (language-agnostic):** bound a value or pick an extreme without branchy `if` chains.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int clamp(int x, int lo, int hi){
      if (x < lo) return lo;
      if (x > hi) return hi;
      return x;            // == max(lo, min(x, hi))
  }
  int a = x < 0 ? -x : x;  // abs
  ```
- **Ladder (raw → convenient):**
  - Python: hand-written `if a < b: ...` → `min(a, b)`, `max(a, b)`, `abs(x)` → `clamp = max(lo, min(x, hi))`. Verified `clamp(15,0,10)==10`, `clamp(-3,0,10)==0`, `abs(-4)==4`.
  - JavaScript: ternary → `Math.min`, `Math.max`, `Math.abs` → `Math.max(lo, Math.min(x, hi))`. Same results.
- **Primitives it supports:** running min/max in a scan, clamping an index into bounds, distance/`abs(a-b)`, low-water/high-water tracking, "keep best so far."
- **Watch-outs:**
  - `clamp` only makes sense when `lo <= hi`; if they can cross, decide precedence deliberately (the `max(lo, min(x, hi))` form lets `lo` win).
  - JS `Math.min()`/`Math.max()` with **no args** return `+Infinity`/`-Infinity` — the correct identity for a running fold, but surprising if you spread an empty array. Python `min([])` raises — pass `default=`.
  - `abs` of the most-negative fixed-width int overflows in C (not in Python's bigints).
- **NeetCode (loose):** Maximum Subarray, Best Time to Buy and Sell Stock, Contains Duplicate II, Squares of a Sorted Array.
- **Sugar:** Python `min(..., default=)` and `key=`; JS spread `Math.max(...arr)` — shortcuts over the explicit scan-and-compare.
- **Cross-ref:** running min/max is Unit 1's extreme-scan; the argmax variant needs `max(key=)` to recover the index.

---

### Light bits (parity, halving, bitmask-as-set)
- **Goal (language-agnostic):** treat an integer as a row of bits — test parity, halve, clear the lowest set bit, or use it as a tiny set.
- **Layer:** pattern
- **C-equivalent:**
  ```c
  int odd  = x & 1;         // parity (== x % 2 for x >= 0)
  int half = x >> 1;        // floor divide by 2 (x >= 0)
  x = x & (x - 1);          // clear lowest set bit -> popcount loop
  mask |= 1 << 3;           // add element 3 to the set
  int has = (mask >> 3) & 1;// membership test for element 3
  ```
- **Ladder (raw → convenient):**
  - Python: `x % 2` → `x & 1`; `x // 2` → `x >> 1`; count bits via `while x: x &= x - 1; c += 1` → `bin(x).count('1')` → `x.bit_count()` (3.10+). Verified `12 & (12-1) == 8`, `12 >> 1 == 6`.
  - JavaScript: `x % 2` → `x & 1`; `Math.floor(x/2)` → `x >> 1`; bitmask set via `mask |= 1 << 3`, test `Boolean(mask & (1 << 3))`. Verified same values.
- **Primitives it supports:** parity check, fast halving (binary search / heap index math), popcount (`x & (x-1)` clears one set bit per step), subset enumeration, "seen" set over a small alphabet as a single int, power-of-two test `x & (x-1) == 0`.
- **Watch-outs:**
  - `x & 1` equals `x % 2` **only for non-negative** `x` (negatives use two's-complement bit 0 — still parity, but reason carefully).
  - `>>` is arithmetic (sign-extending) on signed ints in C and always in Python (Python ints are conceptually infinite two's complement); JS `>>` is signed, `>>>` is the unsigned shift. Prefer `x >> 1` only when `x >= 0`.
  - JS bitwise ops coerce operands to **32-bit signed** — masks break above bit 31; use `Number`/`BigInt` care or Python for wider masks.
  - Bitmask-as-set only scales to a small universe (≤ 32/64 elements) — beyond that, use the hand-built hash set.
- **NeetCode (loose):** Number of 1 Bits, Single Number, Counting Bits, Power of Two, Subsets.
- **Sugar:** Python `int.bit_count()` / `bin(x).count('1')` — earned shortcut for the `x &= x-1` popcount loop.
- **Cross-ref:** `mask |= 1<<k` is the small-universe stand-in for Unit 5's hand-built set capability.

---

**Cross-references to lock in:**
- *Modulo → hashing / wrap-around*: `h % m` here is the bucket step in Unit 4's **hash-map build**; `(i+k) % n` is the ring-buffer index behind Unit 10's **queue**.
- *Polynomial hash → accumulate → hash build*: `h = h*base + x` is Unit 1's accumulate-with-a-multiplier that produces the string key hashed in Unit 4's **hash-map build**; digit-building `h = h*10 + d` is the same move in base 10.
- *Bits → set*: `mask |= 1<<k` is the small-universe stand-in for Unit 5's hand-built **set** capability.
