import { drawArena, drawRobot } from "./arena-art.js"

const canvas = document.querySelector("canvas")
const ctx = canvas.getContext("2d")
const background = document.createElement("canvas")
background.width = canvas.width
background.height = canvas.height
drawArena(background.getContext("2d"))

const fighters = [...document.querySelectorAll(".fighter")].map((panel) => ({
  panel,
  name: panel.querySelector("strong"),
  bar: panel.querySelector("progress"),
}))
const colorNames = { blue: "Blue", red: "Red" }
const visitKey = "slop-bots-last-player-color"
const overlay = document.querySelector(".round")
const status = document.querySelector("#round-status")
const play = document.querySelector("#play")
const buttons = [...document.querySelectorAll("[data-input]")]
const keys = new Map([
  ["KeyA", 1], ["ArrowLeft", 1],
  ["KeyD", 2], ["ArrowRight", 2],
  ["KeyJ", 4], ["Space", 4],
  ["KeyK", 8], ["ShiftLeft", 8], ["ShiftRight", 8],
])

const readyFrame = Uint8Array.of(70, 100, 0, 186, 100, 0, 0)
const frame = readyFrame.slice()
const pressedKeys = new Set()
const pointers = new Map()
const timestep = 1000 / 60
let tapped = 0
let running = false
let loaded = false
let lastTime = 0
let elapsed = 0
let frameRequest = 0
let visit = 0
let playerColor

function render() {
  ctx.drawImage(background, 0, 0)
  fighters.forEach(({ panel, bar }, i) => {
    const offset = i * 3
    const [x, health, action] = frame.subarray(offset, offset + 3)
    if (bar.value !== health) bar.value = health
    drawRobot(ctx, { x, health, action, color: panel.dataset.color, facesRight: i === 0 })
  })
}

function releaseInputs() {
  tapped = 0
  pressedKeys.clear()
  pointers.clear()
  buttons.forEach((button) => delete button.dataset.held)
}

function nextColor() {
  for (const storageName of ["localStorage", "sessionStorage"]) {
    try {
      const storage = window[storageName]
      const color = storage.getItem(visitKey) === "blue" ? "red" : "blue"
      storage.setItem(visitKey, color)
      return color
    } catch {
      // A browser can block one storage API and still allow the other.
    }
  }
  if (playerColor) return playerColor === "blue" ? "red" : "blue"
  return Math.random() < 0.5 ? "blue" : "red"
}

function prepareVisit() {
  visit++
  running = false
  cancelAnimationFrame(frameRequest)
  releaseInputs()
  frame.set(readyFrame)

  playerColor = nextColor()
  const colors = [playerColor, playerColor === "blue" ? "red" : "blue"]
  fighters.forEach(({ panel, name }, i) => {
    panel.dataset.color = colors[i]
    name.textContent = colorNames[colors[i]]
  })
  canvas.setAttribute("aria-label", `${colorNames[colors[0]]} is your robot. ${colorNames[colors[1]]} is the CPU robot.`)
  status.textContent = ""
  play.textContent = "Fight"
  overlay.hidden = false
  if (document.activeElement === canvas) play.focus({ preventScroll: true })
  render()
}

function tick(time) {
  if (!running) return
  elapsed += Math.min(time - lastTime, timestep * 4)
  lastTime = time
  while (elapsed >= timestep && frame[6] === 0) {
    let input = tapped
    tapped = 0
    for (const key of pressedKeys) input |= keys.get(key)
    for (const button of pointers.values()) input |= Number(button.dataset.input)
    window.stepScrapCircuit(input, frame)
    elapsed -= timestep
  }
  render()

  if (frame[6] === 0) {
    frameRequest = requestAnimationFrame(tick)
    return
  }
  running = false
  releaseInputs()
  overlay.hidden = false
  status.textContent = ["", "You win", `${fighters[1].name.textContent} wins`, "Double knockout"][frame[6]]
  play.textContent = "Rematch"
}

async function loadGame() {
  const response = await fetch("./fight.wasm")
  if (!response.ok) throw new Error("Fight rules could not be loaded")
  const binary = await response.arrayBuffer()
  if (!window.Go) await import("./wasm_exec.js")
  const go = new window.Go()
  const { instance } = await WebAssembly.instantiate(binary, go.importObject)
  void go.run(instance)
  if (!window.resetScrapCircuit) throw new Error("Fight rules could not be started")
}

play.addEventListener("click", async () => {
  const currentVisit = visit
  if (!loaded) {
    play.disabled = true
    status.textContent = "Loading fight…"
    try {
      await loadGame()
      loaded = true
    } catch (error) {
      console.error(error)
      if (currentVisit === visit) {
        status.textContent = "Couldn’t load the fight"
        play.textContent = "Retry"
      }
      return
    } finally {
      play.disabled = false
    }
  }
  if (currentVisit !== visit) return
  releaseInputs()
  window.resetScrapCircuit(Math.floor(Math.random() * 0x7fffffff), frame)
  status.textContent = ""
  overlay.hidden = true
  canvas.focus({ preventScroll: true })
  running = true
  lastTime = performance.now()
  elapsed = 0
  render()
  frameRequest = requestAnimationFrame(tick)
})

window.addEventListener("keydown", (event) => {
  if (!running || !keys.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return
  event.preventDefault()
  pressedKeys.add(event.code)
  if (!event.repeat) tapped |= keys.get(event.code)
})
window.addEventListener("keyup", (event) => pressedKeys.delete(event.code))
window.addEventListener("blur", releaseInputs)

for (const button of buttons) {
  button.addEventListener("pointerdown", (event) => {
    if (!running || event.button !== 0) return
    button.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, button)
    button.dataset.held = ""
    tapped |= Number(button.dataset.input)
  })
  button.addEventListener("lostpointercapture", (event) => {
    pointers.delete(event.pointerId)
    if (![...pointers.values()].includes(button)) delete button.dataset.held
  })
  button.addEventListener("click", (event) => {
    if (running && event.detail === 0) tapped |= Number(button.dataset.input)
  })
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) prepareVisit()
})
prepareVisit()
