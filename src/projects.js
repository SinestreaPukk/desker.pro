// Deleting a project keeps its tasks; they just stop belonging to it.
export const unlink = (tasks, id) => tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t))
