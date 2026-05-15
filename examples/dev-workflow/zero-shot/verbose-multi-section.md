---
name: verbose-multi-section
description: This skill is intended to demonstrate a verbose, multi-section LLM-facing instruction file that is a good candidate for aggressive distillation. It is designed to be used as a fixture when manually testing the zero-shot skill.
model: sonnet
---

# Verbose Multi-Section Example

## Overview

This document serves as an illustrative example of the kind of bloated, over-explained LLM-facing prose that the zero-shot skill is designed to handle. It contains several sections, each of which is padded with explanatory framing, qualifiers, and result descriptions that a sufficiently capable model does not actually need in order to act correctly.

## Background

In order to understand why this kind of distillation matters, it is helpful to first consider the broader context. Large language models have generally been trained on enormous corpora of human-written text, and as a result they typically possess a great deal of latent knowledge about common tasks. When you write a skill or instruction file, you should keep in mind that you usually do not need to teach the model how to perform widely-known operations from first principles.

## Purpose

The purpose of this fixture is to provide a realistic but synthetic input that exercises both classification paths of the zero-shot skill. Because it has frontmatter and multiple `##` sections, the skill should classify it as an instruction file and reduce each section to a small number of imperative bullets, rather than collapsing the entire file to one to three sentences as it would for a single-body skill file.

## Behavior Description

When this fixture is processed, the assistant should follow the following steps in the order listed:

### Step 1: Read the File

The assistant should begin by reading the file in its entirety. The assistant should take note of the word count, since this number will be reported back to the user at the end of the run.

### Step 2: Apply the Distillation Rules

Having read the file, the assistant should then apply the distillation rules that are described in the SKILL.md. The assistant should be careful to preserve the frontmatter exactly as it appears, and should reduce each `##` section to between two and six imperative bullets.

### Step 3: Emit the Result

Finally, the assistant should emit the distilled result, either as a fenced markdown block in dry-run mode or by editing the file directly in apply mode.

## Result

The output will consist of the same file structure (frontmatter and `##` headers preserved) but with each section's prose replaced by a short list of imperative bullets. The total word count is expected to drop by a substantial percentage, often on the order of seventy percent or more.
