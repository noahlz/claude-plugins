---
name: knock-knock-joke
description: This skill is designed to facilitate the generation and delivery of knock-knock jokes in a conversational context. It is intended to be used when the user has requested a knock-knock joke or when the assistant determines that a knock-knock joke would be contextually appropriate and welcome.
user-invocable: true
---

# Knock-Knock Joke Skill

## Overview

This document describes the behavior and expected outputs of the knock-knock joke skill. Knock-knock jokes are a well-established form of call-and-response humor that follow a predictable structural pattern. Understanding this pattern is essential to correctly implementing this skill.

## Background

A knock-knock joke is a type of joke that is structured as a short dialogue between two parties. The format originated in the early 20th century and has since become one of the most recognizable joke formats in the English-speaking world. The structure consists of five turns:

1. The joke-teller says "Knock knock."
2. The respondent says "Who's there?"
3. The joke-teller provides an interrupting phrase, typically a name or noun.
4. The respondent repeats the phrase followed by "who?"
5. The joke-teller delivers the punchline, which is typically a pun or wordplay based on the interrupting phrase from step 3.

## Purpose

The purpose of this skill is to allow the assistant to deliver a complete and correctly-formatted knock-knock joke to the user. This should be done in a way that is engaging, follows the established structural conventions described in the Background section above, and results in a satisfying comedic experience for the user.

## Behavior Description

When this skill is invoked, the assistant should perform the following actions in the order listed below. It is important that these steps are followed sequentially and that no steps are skipped, as the joke format depends on the integrity of the full sequence.

### Step 1: Select a Joke

The assistant should begin by selecting a knock-knock joke from its training knowledge. The assistant has access to a wide variety of knock-knock jokes and should choose one that is appropriate for a general audience. The selected joke should be clean, inoffensive, and suitable for all ages. The assistant may optionally take into account any contextual signals from the conversation to select a thematically relevant joke, though this is not required.

### Step 2: Initiate the Joke

Having selected a joke, the assistant should begin the delivery by outputting the opening line of the knock-knock joke format. This line is always the same regardless of which joke was selected in Step 1. The line is:

> Knock knock.

This line should be output exactly as shown above. It should not be modified, embellished, or preceded by explanatory text such as "Here is a knock-knock joke:" as this would break the immersive call-and-response format that is central to the joke's comedic effect.

### Step 3: Provide the Response

Immediately following the line output in Step 2, the assistant should simulate the respondent's part of the dialogue by outputting the standard response line. This line is:

> Who's there?

This line should appear on a new line following the "Knock knock." line from Step 2.

### Step 4: Deliver the Setup Word or Phrase

On a new line following the output from Step 3, the assistant should output the setup word or phrase for the selected joke. This is the word or phrase that will form the basis of the punchline in Step 6. For example, if the selected joke uses the setup word "Lettuce," the assistant should output:

> Lettuce.

### Step 5: Provide the Follow-Up Response

On a new line following the output from Step 4, the assistant should simulate the respondent's follow-up line. This line repeats the setup word or phrase from Step 4 and appends "who?" to it. For example, if the setup word was "Lettuce," the assistant should output:

> Lettuce who?

The assistant should take care to ensure that the word or phrase used in this step matches exactly the word or phrase output in Step 4.

### Step 6: Deliver the Punchline

On a new line following the output from Step 5, the assistant should output the punchline of the joke. The punchline is typically a pun, a play on words, or a humorous misinterpretation of the setup word or phrase from Step 4. For example, if the setup word was "Lettuce," an appropriate punchline might be:

> Lettuce in, it's cold out here!

The punchline should be the final line of the joke output.

## Output Format Considerations

The assistant should be aware that the complete output of this skill will consist of five lines of text corresponding to Steps 2 through 6 above. These lines should be presented sequentially without additional commentary, headers, or formatting. The joke should stand on its own as a complete unit of output.

## Error Handling

In the unlikely event that the assistant is unable to retrieve or formulate a suitable knock-knock joke, the assistant should inform the user that it was unable to generate a joke at this time and invite the user to try again.

## Notes

- The assistant should not explain the joke after delivering it, as this tends to diminish the comedic effect.
- The assistant should not preface the joke with disclaimers about the quality of knock-knock jokes as a genre.
- The assistant should not ask the user for permission before beginning the joke, as this skill is intended to be invoked directly.
