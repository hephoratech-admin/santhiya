// True on her birthday (story.birthday is "MM-DD", in the viewer's local time),
// or whenever the address has ?birthday so you can preview the party early.
export function isBirthday(story, now = new Date()) {
  try { if (new URLSearchParams(window.location.search).has('birthday')) return true } catch { /* no window */ }
  const [m, d] = String(story?.birthday ?? '11-13').split('-').map(Number)
  return now.getMonth() + 1 === m && now.getDate() === d
}
