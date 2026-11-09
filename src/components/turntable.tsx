import { SocialLinks } from "@/components/footer"
import { TransitionLink } from "@/components/transition-link"
import { DeckShell } from "@/components/deck-shell"

const ranges = [
  { section: "player", id: "p-volume", label: "Volume", min: 0, max: 1, step: 0.01, value: 1 },
  { section: "cartridge", id: "p-vtf", label: "Tracking g", min: 0.2, max: 4, step: 0.05, value: 1.8 },
  { section: "cartridge", id: "p-antiskate", label: "Anti-skate", min: 0, max: 4, step: 0.05, value: 1.8 },
  { section: "cartridge", id: "p-hum", label: "Mains hum", min: 0, max: 3, step: 0.05, value: 0 },
  { section: "pressing", id: "c-noise", label: "Surface", min: 0, max: 4, step: 0.05, value: 1 },
  { section: "pressing", id: "c-dust", label: "Dust", min: 0, max: 3, step: 0.05, value: 0.25 },
  { section: "pressing", id: "c-scratches", label: "Scratches", min: 0, max: 2, step: 0.05, value: 0.2 },
  { section: "pressing", id: "c-warp", label: "Warp mm", min: 0, max: 2, step: 0.05, value: 0.3 },
  { section: "pressing", id: "c-offCenter", label: "Off-centre", min: 0, max: 1.5, step: 0.05, value: 0.15 },
] as const

function Ranges({ section }: { readonly section: (typeof ranges)[number]["section"] }) {
  return ranges.flatMap(({ section: rangeSection, id, label, min, max, step, value }) =>
    rangeSection === section
      ? [
          <div key={id} className="row">
            <label htmlFor={id}>{label}</label>
            <input id={id} type="range" min={min} max={max} step={step} defaultValue={value} />
            <output htmlFor={id}></output>
          </div>,
        ]
      : [],
  )
}

/**
 * The record player. public/vinyl/src/main.js finds these elements by id, draws the deck into #gl and
 * plays the record through an AudioWorklet. Rendered once in the root layout, so it keeps playing between pages.
 */
export function Turntable() {
  return (
    <DeckShell>
      <canvas id="gl" aria-label="A record player. Drag to look around, click the record to drop the needle." />
      <div id="vig" />
      <div id="loader" className="wait">
        <div className="bar"><i id="loader-fill" /></div>
        <span id="loader-pct" />
      </div>

      <nav id="toggles" aria-label="Record player">
        <button id="t-records" type="button" aria-pressed="false" title="Records">
          <span id="now-cover" aria-hidden="true" hidden />
          <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
          <span id="now-title">Records</span>
          <span id="now-time" />
        </button>
        <button id="t-play" type="button" aria-label="Pause" data-state="playing">
          <svg className="icon-pause" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          <svg className="icon-play" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l13 7L7 19z" /></svg>
        </button>
        <button id="t-ctl" type="button" aria-pressed="false">Controls</button>
      </nav>

      <nav id="deck-nav" className="deck-nav" aria-label="Main">
        <TransitionLink href="/about">[about]</TransitionLink>
        <TransitionLink href="/blog">[writing]</TransitionLink>
      </nav>
      <nav id="credit" aria-label="Social">
        <SocialLinks />
      </nav>
      <div id="foot">
        <button id="t-reset" type="button" hidden>Reset view</button>
        <span id="status" role="status" />
      </div>

      <section id="ctl" className="panel" aria-label="Controls" hidden>
        <div className="row">
          <button id="b-start" type="button">Start</button>
          <button id="b-cue" type="button">Cue</button>
        </div>
        <div className="row">
          <button type="button" data-rpm="33.3333" className="on">33</button>
          <button type="button" data-rpm="45">45</button>
          <button type="button" data-rpm="78.26">78</button>
        </div>
        <Ranges section="player" />

        <h2>Cartridge</h2>
        <div className="row">
          <select id="p-stylus" aria-label="Stylus" defaultValue="elliptical">
            <option value="elliptical">Elliptical 0.3 x 0.7 mil</option>
            <option value="conical">Conical 0.7 mil</option>
            <option value="microline">Micro-line</option>
          </select>
        </div>
        <Ranges section="cartridge" />

        <h2>This pressing</h2>
        <Ranges section="pressing" />
        <div className="row">
          <button id="b-press" type="button">Press again</button>
          <label className="file" htmlFor="f-audio">Cut a file</label>
          <input id="f-audio" type="file" accept="audio/*" multiple hidden />
        </div>
        <div className="row"><button id="b-bump" type="button">Knock the table</button></div>
      </section>

      <section id="shelf" className="panel" aria-label="Records" hidden />

      <div id="power"><span id="power-msg">click to power on</span></div>
    </DeckShell>
  )
}
