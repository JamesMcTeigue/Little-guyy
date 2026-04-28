## Design Intent

What were you trying to achieve?

### The goal
Its goal is to escape so they can be together and stop solving mazes.You help be clearing their path and spending gems to assisthem in their travels.

### Why this direction
I started with one little guy solving mazes, buut they seemed lonley so I added things to make it more interactive, the ghoust, gems, doors exct. careing for them became a game, and adding another made it mor chalengeing to keep trak of both of them.

All the the Actual code for this assinemnt was done by AI, with me leading the ideas and planing for the interactions between the usert and the little guys

### Who is this for
This is for people who want a distraction that requiers your constant attention, you look away and they died almost without fail. potentinoal training ofr new perants for looking after kids, futher resurech required.

---

## Inspiration & References

What influenced this project? Cite anything that isn't yours.

### Visual references
PAC-MAN is where the idea of them solving a maze came from

### Movements or aesthetics
It's very ret-ro digital, everything looks like it came from an old school game

---

## AI & Prompting Process

How did you use AI tools in this project? This section is important. We want to see how you worked with AI, not just that you did.

### Tools used
Claude

### How you used them
I copied and pasted back and forth

### What you used AI for

AI was purely used for programming.
(also the visuals, but I'm not sure if you made AI-generated images or put shapes in places)

### What worked

Describe prompts or approaches that got useful results. Include examples.

This example is where I asked to spread out the spawn rates of everything, and fix the pathing problem where it couldn't pick a new path to travel through the maze
```
Example prompt that worked well:
Can we spread out the spawn rate of everything, and the little guys bug out and glide through walls to where the mutate is? If they mutate the maze, then die, can we have them always respawn at the start? Also, can we generate the maze with multiple openings using a randomised depth-first search (DFS) so they have multiple choices?
```

### What didn't work

What did you prompt that gave poor results? How did you adjust?

---

## What I Tried That Didn't Work

Dead ends and failed experiments are part of the process. Don't skip this section.

### Attempt 1: I tried to use ChatGPT once

**What I tried:* 
I tried to use ChatGPT once when I ran out of cookies in Claud

**Why it didn't work:** 
GBT ran out of cookies after one question

**What I learned:** the takeaway
Claud is far more reliable than almost any other AI

---

## 👾 The Familiar — Concept

Introduce your famila. What is it?

### Name & identity

There are too few guys in my assignment, "Liquid Blue "and "Liquid Purple", and they are sentient liquid beings trying to escape 

### The metaphor

They represent the neverning struggle against assinment that we can never eraly escape, forever trapped in thae maze that is the University

### Personality

Both of them are rather neutral but with short fuses that get angry almost as soon as something is blocking their path that you haven't opened.


### Why this concept

I watched a video of an octopus solving mazes receently befor the we started this assignment

---

## 👾 Needs & Wants

Your familiar must "want" or "need" something. Describe the mechanic.

### What it wants

They want to be free together, stuck in a never-ending deathloop just out of reach from each other

### What happens when the need goes unmet

When they are left alone, they are unable useualy unable to complete the maze and will be hunted over and over again by the ghosts that roam the maze. Dying endlessly till you briefly give them hope.

### What satisfies it

Completing the maze will make you happy and bring up half of a heart on the screen; the other half is with the other little guy.

---

## 👾 States & Behaviours

Describe the states your familiar can be in and how it moves between them.

### States

List each state and what it looks/behaves like:

| State | Appearance / behaviour |
|-------|----------------------|
| Angery| Rtay outside the door, Trund red |
| Happy | Reached the end of the maze, showing half of a heart |


### Transitions
If either of them touches a bad  ghost, they will die and be sent back to the beginning

### Autonomous behaviour
Solving the maze to the best of their abilities, parts of the maze require user input, but once they die, they will change their pathing to go a different way.

### Persistence across visits
keeps track of their deaths, times solved, and total gems earned

---

## 👾 Inputs & Responses

Your familiar must respond to at least two different types of input. Document them here.

### Input 1 — opening doors

**Type:** mouse click

**Why this input:** 
This was the first thing I added, so the user could help the little guys. I added it beucase is was simple and made sense for the "game".

**How the familiar responds:** 
The doors swing open, and the little guys can continue on their way to the end of the maze.


### Input 2 — Summoning The golden ghosts

**Type:** e.g. mouse click

**Why this input:** 
I wanted something to deal with the growing number of ghosts that would kill the little guys, so I gave them a predator to hunt the bad ghosts.

**How the familiar responds:** 
The famlia dosen't actually change, they continue through the maze while the golden ghost takes out an evil ghost.


### Input 3 — Mutating the maze

**Type:** e.g. Mouse click

**Why this input:** 
I wanted a way to change the maze without completely resetting the whole thing maze.

**How the familiar responds:** 
Will path find if a better route appears because of the mutation