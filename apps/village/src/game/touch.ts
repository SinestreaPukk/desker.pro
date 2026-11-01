/** The phone layout (SPEC Checkpoint 10): any device whose main pointer is a finger. `?touch=1` forces it, for testing on a desktop. */
export const isTouchUi = () => matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch')
