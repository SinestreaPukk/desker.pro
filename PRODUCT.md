# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students first: people juggling school with their own goals and projects. Desker is not limited to study work, and it is not a study helper.

They come to log what is on their plate, see what is coming up, decide what to do right now, and leave.

## Product Purpose

Desker is a low-friction to-do list and calendar that ranks tasks and projects so you know what to do next, in under 2 minutes per visit.

It suggests what to do and keeps track of progress. It does not teach, plan or break down how to do the work.

Success means a visit takes under 2 minutes and ends with the person knowing what to do next.

## Positioning

- **A clear top pick, and your choice.** It suggests what to do right now, ranked from your own goals and your progress against time left. Ranked alternatives sit under it, so you can weigh what you have to do against how you feel.
- **A short reason why.** It explains briefly why it chose that task for you right now, to build trust.
- **Almost no effort.** Log tasks and projects in under 2 minutes, typing only titles. Everything else is a tap.
- **No explaining needed.** You never describe your project or idea to the app. A title and a few taps are enough, and adding uses no AI, so private ideas stay private.

## Operating Context

Short visits in a browser, on desktop or phone. The AI assistant chat is the one place for longer typing.

## Capabilities and Constraints

Decided:

- Three pages: Now, Calendar and Goals. There is no separate Projects page; projects sit under their goal on Goals.
- Now shows a top pick, 5 ranked alternatives that can each be started, and Coming up with due dates and today's meetings. Things due today with no goal appear in a line under the top card.
- The four-box matrix is hidden behind "View matrix". Dragging a task there overrides its rank until "Let the app decide" is pressed.
- Add is a button with a title and a Task or Project choice, and uses no AI. AI is used only in chat.
- Goals are ranked, and importance comes from that rank. Urgency can still put a lower-ranked goal first.
- Goals has one vision sentence above a ranked list, with no pyramid and at most 5 goals.
- People who do not know their goals get a goal finder of at most 5 multiple-choice questions, covering up to 3 areas. Their taps fill in goal titles and a vision they can keep or edit. It opens on the first visit and can be skipped.
- A project is linked to a goal by picking from the user's goals. "Not in my goals" is a choice, and it makes the project less important.
- Every project uses one Progress scale, 0 to 5. It is asked when the project is added and again when any task in it is finished. Ignoring it keeps the last number.
- Progress is compared with time left as days left per progress step left. A plain task counts as one step.
- A project's task is simply what to do, such as "Review for the test". It is never a breakdown of how to do it.
- The app never fixes a number of sessions, because that depends on the person. They keep coming until the deadline or 5/5, and the next one appears the following day.
- The calendar holds only classes and meetings, added like Apple Calendar or imported, with a Day, Week and Month switch. Tasks, sessions and due dates stay off it, and nothing is sent out to other calendars.
- English for now. Titles can be typed in any language.

Technical:

- Vercel Hobby allows 12 serverless functions, and the app uses all 12 today.
- Data is tied to an anonymous browser ID. There is no login yet.

Not decided yet: the items marked "still an assumption" in the upgrade plan's "Numbers and defaults" table, including the urgency values, the score formula, and the finder's areas and choices.

## Brand Commitments

The name is Desker. The logo is `public/favicon.svg`.

## Evidence on Hand

No testimonials, customer numbers or benchmarks are recorded in this repo. Do not make any up.

## Product Principles

1. **Type only titles and chat.** Titles of tasks, projects, goals and meetings, the vision sentence if you want to reword it, and AI chat messages. Everything else is a tap.
2. **Enter saves.** Follow-up questions are optional and never block.
3. **Ask only what the app cannot work out**, and never more than 3 taps after the title.
4. **Suggest, never order, and never say how.** A top pick with a short reason, and ranked alternatives under it, so people can weigh what they have to do against how they feel. "Review for Statics midterm. Progress 2/5 with 3 days left." Nothing about chapters.
5. **No rank button, and no AI outside chat.** The order is always live, instant and works without AI.
6. **Never fix a number of sessions.** How much work something takes depends on the person. Sessions keep coming until the deadline or 5/5.
7. **The calendar is for classes and meetings only.** Tasks, sessions and due dates stay off it.
