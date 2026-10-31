import { Avatar } from './px.jsx'
import { PRIVACY_CONTACT_EMAIL, LEGAL_UPDATED } from './config.js'

// OWNER: this text describes what the code does today (checked against api/ and src/ on the "last updated" date).
// Have a person you trust read it before launch, and update it whenever the app starts storing or sending something new.
const mail = <a className="underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
const L = (to, text) => <a className="underline" href={to}>{text}</a>

const PAGES = {
  privacy: ['Privacy', [
    ['In short', <>Desker is a study planner. It keeps what you put into it so it can plan your days, and it learns from how you work so the plans get better. Nobody can see your tasks except you. We do not sell your data, show ads, or use a third-party analytics service. You can download everything or delete your account at any time.</>],
    ['What Desker keeps', <>
      <p>Your account: email address, username, and a password (stored only as a scrambled hash, never as readable text). If you sign in with Google or GitHub we receive your name and email from them.</p>
      <p className="mt-2">What you add: tasks, deadlines, goals, projects, hobbies and free hours, the dates and times of events from any calendar file or link you import. Your chat with the kodama is not kept on our servers; it lives in your browser tab and is gone when you close it.</p>
      <p className="mt-2">What Desker learns: when you focus, how long finished tasks really took compared with your guess, your energy taps, and how your plans went. This is the “Rhythm” page. It stays in your account and is used only to plan for you.</p>
      <p className="mt-2">Your settings and progress: theme, kodama stage, wrap-up answers and similar.</p>
      <p className="mt-2">Technical records: when you sign in, your browser type and network address are kept with your sign-in session so you can stay signed in and we can spot abuse. Temporary counters of your network address limit how often someone can try to sign in; they are removed automatically. We also record that an AI request happened (the time, which feature, and how much text it used), but not what it said.</p>
    </>],
    ['Product analytics', <>If it is switched on, Desker keeps a simple log of events tied to your account (for example “signed up”, “task completed”, “timer used”) to learn whether students come back and whether planning gets more accurate. An event is a name, a time and a few numbers or fixed words. It never contains task titles, notes, chat text or anything else you wrote. It is stored in our own database, not sent to a third-party analytics company, and it is deleted with your account.</>],
    ['AI and the kodama', <>
      <p>Desker uses Claude, made by Anthropic, to talk with you and to make plans. When you use one of these features, the text it needs is sent to Anthropic through their API, and the answer comes back to you:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><b>Chat with the kodama and planning</b>: your goals, tasks, deadlines, projects and hobbies, free hours, calendar event titles and times for the next two weeks, your mood and energy pattern, a short summary of your rhythm, and the messages in the current chat (including anything you type to the kodama).</li>
        <li><b>“What should I do now”, “Prioritise”, “Replan”, deadline and project breakdowns</b>: the tasks, deadlines and free time those need, and what you typed.</li>
        <li><b>Reading a syllabus, photo, PDF or web page you add</b>: that file or the text of that page.</li>
      </ul>
      <p className="mt-2">It is used only to answer you. Anthropic’s own terms and privacy policy apply to what they receive. Desker does not use your data to train anything. Nothing is sent to an AI service unless you use one of these features.</p>
    </>],
    ['Where it is kept', <>Desker runs on Vercel (the website and its servers). Your data is stored in a Postgres database hosted by Neon on Amazon Web Services in the US East (N. Virginia) region. Confirmation and password-reset emails are sent through Resend. If you import a calendar from a link, Desker’s server fetches that link for you. Because of these services your data is processed in the United States.</>],
    ['Calendar feed', <>If you subscribe another calendar app to your Desker feed, the feed address contains a long random code. Anyone who has that address can see your task titles and dates, so keep it private.</>],
    ['How long we keep it', <>For as long as your account exists. Things you delete are removed from your account. When you delete your account, everything tied to it (tasks, learned data, analytics events, AI request records and sign-in sessions) is deleted. Backups kept by our database provider expire on their own schedule.</>],
    ['Your choices', <>
      <ul className="list-disc space-y-1 pl-5">
        <li>Download your data: Settings → Export JSON, or Rhythm → Download my rhythm data.</li>
        <li>Stop Desker learning from you: Rhythm → turn off “Learn from how I work”.</li>
        <li>Ignore a stretch of time you do not want it to learn from, or delete everything it learned: Rhythm → Your data.</li>
        <li>Delete your account and everything in it: Settings → Danger zone.</li>
      </ul>
      <p className="mt-2">To ask a question or ask us to do any of this for you, write to {mail}.</p>
    </>],
    ['Changes', <>If this page changes in a way that matters, we will tell you in the app. The date at the top is when it was last updated.</>],
  ]],
  terms: ['Terms of use', [
    ['Beta', <>Desker is in a closed beta for university students. It is free while in beta, it may change or have bugs, and features may be added or removed. We will try to give notice before we stop the service, and you can always download your data first.</>],
    ['Who can use it', <>Desker is made for university students. Keep your password to yourself and tell us if you think someone else is using your account. One person, one account.</>],
    ['What you agree to', <>Use Desker for your own planning. Do not try to break it, overload it, read other people’s data, or use it to harm anyone. Do not put in anything you have no right to share. We may pause or close an account that does.</>],
    ['Your content', <>Your tasks, notes and chats are yours. You give Desker permission to store them and, when you use an AI feature, to send what that feature needs to our AI provider, so the service can work for you (see the {L('/privacy', 'Privacy page')}). We do not use your content for anything else.</>],
    ['A planning aid, not advice', <>Desker’s plans and the kodama’s suggestions are guesses based on what you tell it. They can be wrong. You are responsible for your deadlines, exams and your own wellbeing. The kodama is not a counsellor or doctor; if you are struggling, please talk to someone at your university or a health professional.</>],
    ['No guarantees', <>Desker is provided as it is during the beta. We work hard to keep your data safe, but we cannot promise it will always be available or error-free, so keep a copy of anything you cannot lose (Settings → Export JSON). To the extent the law allows, we are not liable for losses from using it.</>],
    ['Changes and contact', <>We may update these terms; if the change matters we will tell you in the app, and continuing to use Desker means you accept it. Questions: {mail}.</>],
  ]],
}

export default function Legal({ kind }) {
  const [title, sections] = PAGES[kind]
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <a href="/" className="mb-6 flex items-center gap-3" aria-label="Desker home"><Avatar /><span className="text-2xl">Desker</span></a>
      <h1 className="mb-1 text-4xl">{title}</h1>
      <p className="mb-6 text-base text-slate-700">Last updated: {LEGAL_UPDATED}</p>
      {sections.map(([h, t]) => <section key={h} className="mb-5"><h2 className="mb-1">{h}</h2><div className="text-slate-700">{t}</div></section>)}
      <p className="mt-8 flex gap-4 text-base">{L('/', 'Home')}{L(kind === 'privacy' ? '/terms' : '/privacy', kind === 'privacy' ? 'Terms' : 'Privacy')}</p>
    </div>
  )
}
