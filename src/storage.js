// Upgrades a saved workspace document to the current shape. Every new field must be optional so old data keeps working.
export function migrate(d) {
  return { ...d, goals: d.goals || [], tasks: d.tasks || [], hobbies: d.hobbies || [], deadlines: d.deadlines || [], projects: d.projects || [], freeHours: d.freeHours ?? 4 }
}
