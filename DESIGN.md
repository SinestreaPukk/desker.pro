---
name: Desker
description: A low-friction to-do list and calendar that ranks tasks and projects so you know what to do next.
colors:
  paper: "#ffffff"
  ink: "#14213d"
  panel: "#f3f6fc"
  primary: "#b4caf0"
  primary-hover: "#9fbbea"
  pale: "#e6edfa"
  accent: "#35599a"
  accent-dark: "#274677"
  line: "#e1e8f4"
  control: "#c9d3e8"
  danger: "#b3261e"
  leaf: "#2e7d32"
  amber: "#8a5a14"
  stone: "#8a97b0"
  white: "#ffffff"
  slate-50: "#f8faff"
  slate-100: "#f3f6fc"
  slate-200: "#e1e8f4"
  slate-300: "#c9d3e8"
  slate-400: "#9aa6bf"
  slate-500: "#5f6b86"
  slate-600: "#4d5873"
  slate-700: "#3a4560"
  slate-800: "#27314a"
  slate-900: "#14213d"
typography:
  greeting:
    fontFamily: "'Instrument Serif', ui-serif, Georgia, serif"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Instrument Sans', Inter, ui-sans-serif, system-ui, sans-serif"
    lineHeight: 1.5
    fontFeature: "'tnum'"
  text-sm:
    fontFamily: "'Instrument Sans', Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    lineHeight: "1.4rem"
  text-xs:
    fontFamily: "'Instrument Sans', Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    lineHeight: "1.25rem"
---

# Design System: Desker

## Overview

From `src/index.css`: "White page, pale-blue tonal panels, soft radii, one pastel-blue action, deep blue only for links and small marks."

This file records only the current colours and fonts, unchanged from `src/index.css`. Layout, shapes and components are not recorded here yet.

## Colors

One pastel-blue action on a white page, with tonal blue surfaces and blue-tinted greys.

### Primary

- **Primary:** primary actions and active states.
- **Primary hover:** the hover state of primary actions.

### Secondary

- **Accent:** links, focus outlines, ticked checkboxes and other small marks.
- **Accent dark:** small text on pale tags.

### Neutral

- **Paper and White:** the page and white surfaces.
- **Ink:** main text.
- **Panel:** tonal panels.
- **Pale:** selected states and soft tags.
- **Line:** hairline borders.
- **Control:** borders of inputs and secondary buttons.
- **Stone:** typing dots and the tint on imported calendar events.
- **Slate 50 to 900:** blue-tinted greys, mainly for secondary text.

### Status

- **Danger:** errors and destructive actions.
- **Leaf:** the Done button in the focus timer.
- **Amber:** warnings.

## Typography

**Display Font:** Instrument Serif (with ui-serif, Georgia, serif)
**Body Font:** Instrument Sans (with Inter, ui-sans-serif, system-ui, sans-serif)

Both load from Google Fonts in `index.html`: Instrument Sans at 400, 500 and 600, and Instrument Serif at 400.

### Hierarchy

- **Greeting:** Instrument Serif for the greeting and big page titles.
- **Body:** Instrument Sans for everything else, with tabular numbers.
- **Text sm and Text xs:** the app's two small text sizes, set in the `@theme` block.

## Do's and Don'ts

### Do:

- **Do** keep these colours and fonts unchanged during the upgrade.

### Don't:

- **Don't** use Accent for main buttons. It is for links and small marks, and Primary is the action colour.
