---
name: Two-column PDF question imports
description: Reliable extraction of textbook multiple-choice questions and answer keys from two-column PDFs.
---

For two-column question PDFs, PyMuPDF's default text sequence can interleave or reverse the printed reading order. Group text blocks by their horizontal position, read the left column top-to-bottom before the right, and account for a question or explanation continuing across a column or page. Answer-key labels may contain Unicode spaces, so avoid ASCII-only whitespace matching.

**Why:** a textbook PDF's answer section required column-aware ordering, and an em-space between the question number and “Answer” caused an ASCII-only parser to miss every key entry.

**How to apply:** validate that question numbers, option counts, answer-key entries, and explanations all cover the expected set; render pages for visual review when a question relies on a figure.
