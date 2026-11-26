const palettes = {
  blue: ["#11182d", "#174264", "#177eac", "#36b4dc", "#a8f1ff", "#eefeff"],
  red: ["#321321", "#752136", "#bb3438", "#f35948", "#ffad85", "#fff0d5"],
}
const floor = 117
const laserCharging = 6
const laserFiring = 7
const rocketJump = 8
export const transforming = 9
const teleportCharging = 10
const teleportArriving = 11
const hoverCharging = 12
const hoverFiring = 13
const hoverLanding = 14
const playerEyeY = floor - 57

function painter(ctx) {
  return (color, x, y, width, height) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)
  }
}

export function drawArena(ctx) {
  const rect = painter(ctx)
  rect("#17131f", 0, 0, 256, 144)
  rect("#271d2a", 0, 17, 256, 69)
  rect("#211823", 0, 86, 256, 30)

  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 9; col++) {
      const x = col * 33 + (row % 2) * 16
      const y = row * 13 + 16
      rect((row + col) % 3 === 1 ? "#30242e" : "#2b202a", x, y, 32, 12)
      rect("#392831", x, y, 32, 1)
      rect("#201823", x + 1, y + 11, 31, 1)
    }
  }

  rect("#3b2b35", 79, 37, 98, 76)
  rect("#584049", 88, 28, 80, 9)
  rect("#4c373f", 84, 36, 89, 76)
  rect("#20141e", 91, 41, 74, 71)
  rect("#20141e", 101, 35, 54, 6)
  rect("#47232a", 96, 58, 64, 53)
  rect("#622e30", 96, 78, 64, 33)
  rect("#8c412e", 96, 95, 64, 16)
  rect("#bd572f", 101, 102, 54, 9)
  rect("#e47c3d", 113, 107, 32, 4)
  for (const x of [100, 111, 123, 135, 147, 155]) {
    rect("#241824", x, 46, 4, 66)
    rect("#5f3a39", x + 4, 46, 1, 65)
  }
  rect("#443039", 91, 63, 74, 3)
  rect("#33242e", 91, 91, 74, 3)

  for (const x of [13, 224]) {
    rect("#1d1722", x - 3, 17, 26, 101)
    rect("#47313d", x + 1, 17, 19, 99)
    rect("#5a4047", x + 1, 18, 3, 98)
    rect("#352533", x + 15, 18, 5, 98)
    rect("#6d4e4d", x, 29, 21, 4)
    rect("#332532", x + 5, 37, 11, 24)
    rect("#6c423b", x + 6, 39, 9, 17)
    rect("#a85e40", x + 7, 40, 7, 14)
    rect("#e09553", x + 9, 41, 3, 11)
    rect("#f8cb79", x + 10, 43, 2, 8)
    rect("#6d4e4d", x - 2, 106, 24, 6)
  }

  rect("#110f19", 0, 0, 256, 10)
  rect("#4d3841", 0, 10, 256, 3)
  rect("#322430", 0, 13, 256, 4)
  rect("#12101a", 0, 113, 256, 31)
  rect("#725448", 0, 113, 256, 2)
  rect("#4e3940", 0, 115, 256, 6)
  rect("#35282f", 0, 121, 256, 4)
  for (let x = 0; x < 256; x += 32) {
    rect("#241b27", x, 116, 2, 9)
    rect("#977052", x + 3, 116, 2, 2)
    rect("#43333a", x + 1, 128, 28, 2)
    rect("#2b212c", x + 2, 130, 27, 11)
  }
}

export function drawRobot(ctx, { x, health, action, color, facesRight, laserRange, targetX, lift, rocketBoots, bossGrowth }) {
  const shades = palettes[color]
  const rect = painter(ctx)
  const bootY = floor - lift
  const scale = 1 + bossGrowth * 0.28
  const scaled = value => Math.round(value * scale)
  const mark = (tint, dx, dy, w, h) => {
    const left = facesRight ? dx : -dx - w
    rect(tint, x + scaled(left), bootY + scaled(dy), scaled(left + w) - scaled(left), scaled(dy + h) - scaled(dy))
  }
  const part = (shade, dx, dy, w, h) => {
    mark(shades[shade], dx, dy, w, h)
  }

  const knockout = health === 0
  const punching = action === 2 && !knockout
  const guarding = action === 4 && !knockout
  const windingUp = action === 1 && !knockout
  const reeling = action === 5 && !knockout
  const hoveringLaser = action === hoverCharging || action === hoverFiring
  const recoil = reeling ? -3 : 0
  const headY = knockout ? -86 : reeling ? -70 : -65
  const gloveX = punching ? 29 : guarding ? 13 : windingUp ? -8 : 12
  const gloveY = guarding ? -54 : windingUp ? -41 : -45

  rect("#191420", x - scaled(22), floor, 2 * scaled(22), 4)
  if (action === transforming) {
    const rise = 12 + Math.round(bossGrowth * 68)
    mark("#63384f", -23, -rise, 46, 4)
    mark("#ffc371", -23, -rise, 4, 3)
    mark("#ffc371", 19, -rise, 4, 3)
  }
  if (bossGrowth >= 0.45) {
    drawWings(part, mark)
  }
  part(0, -16, -27, 14, 21)
  part(0, 0, -29, 14, 23)
  part(1, -14, -24, 11, 17)
  part(2, -12, -22, 8, 13)
  part(0, -19, -9, 16, 10)
  part(2, -18, -8, 14, 6)
  part(3, -17, -8, 11, 2)
  part(1, -18, -3, 14, 2)

  part(1, 1, -28, 12, 23)
  part(2, 3, -25, 10, 16)
  part(3, 4, -22, 7, 7)
  part(4, 5, -21, 5, 2)
  part(0, 1, -10, 16, 11)
  part(0, 3, -6, 19, 7)
  part(2, 2, -9, 14, 7)
  part(2, 4, -5, 17, 4)
  part(3, 3, -9, 12, 2)
  part(4, 16, -5, 4, 1)

  if (rocketBoots) {
    drawBoots(part, mark, action === rocketJump || hoveringLaser || (action === hoverLanding && lift > 0))
  }

  part(0, -13, -52, 23, 24)
  part(0, -17, -47, 32, 13)
  part(0, -14, -35, 26, 9)
  part(1, -14, -46, 27, 12)
  part(2, -11, -50, 20, 19)
  part(2, 3, -45, 9, 10)
  part(3, -10, -50, 17, 5)
  part(3, -5, -45, 14, 4)
  part(4, -8, -49, 11, 2)
  part(4, 8, -43, 4, 2)
  part(1, -12, -34, 22, 7)
  part(3, -9, -31, 17, 2)
  part(5, 7, -37, 2, 2)

  part(0, -5 + recoil, headY + 14, 9, -headY - 60)
  for (let y = headY + 16; y < -52; y += 3) {
    part(4, -3 + recoil, y, 5, 1)
  }
  part(0, -14 + recoil, headY + 2, 24, 13)
  part(0, -11 + recoil, headY, 20, 4)
  part(0, 5 + recoil, headY + 3, 9, 7)
  part(0, -6 + recoil, headY + 13, 17, 5)
  part(2, -13 + recoil, headY + 2, 21, 12)
  part(3, -11 + recoil, headY + 1, 20, 5)
  part(4, -10 + recoil, headY + 2, 15, 1)
  part(3, 7 + recoil, headY + 4, 6, 3)
  part(1, -4 + recoil, headY + 6, 16, 5)
  part(5, 1 + recoil, headY + 7, 8, 1)
  part(5, 5 + recoil, headY + 8, 5, 1)
  part(3, 3 + recoil, headY + 11, 7, 2)
  part(2, -4 + recoil, headY + 14, 14, 3)
  part(1, -10 + recoil, headY + 7, 5, 6)
  part(4, -10 + recoil, headY + 8, 2, 2)
  part(1, 0 + recoil, headY + 15, 7, 1)

  if (bossGrowth >= 0.45) {
    mark("#ffc371", -5 + recoil, headY + 1, 11, 2)
    mark("#ffc371", -2, -36, 6, 3)
  }

  part(0, -16, -48, 13, 21)
  part(0, -21, -44, 23, 13)
  part(0, -23, -40, 27, 6)
  part(2, -17, -46, 15, 16)
  part(2, -21, -42, 21, 10)
  part(3, -17, -45, 12, 4)
  part(4, -17, -44, 8, 1)
  part(3, -19, -40, 5, 6)
  part(1, -13, -40, 8, 7)
  part(4, -12, -39, 5, 2)
  part(0, -11, -37, 3, 2)

  if (knockout) {
    part(0, 3, -38, 9, 23)
    part(0, 3, -23, 11, 9)
    part(1, 4, -37, 7, 20)
    part(2, 4, -22, 9, 7)
    return
  }
  if (punching) {
    part(0, -3, -43, 36, 11)
    part(2, -1, -42, 32, 8)
    part(4, 4, -42, 25, 2)
  } else {
    const elbow = windingUp ? -15 : -4
    const upperArmWidth = windingUp ? 11 : 21
    part(0, elbow, -36, upperArmWidth, 8)
    part(2, elbow + 2, -35, upperArmWidth - 4, 5)
    part(3, elbow + 3, -35, upperArmWidth - 8, 2)
    const forearmHeight = -gloveY - 35
    part(0, gloveX - 5, gloveY + 7, 12, forearmHeight)
    part(2, gloveX - 3, gloveY + 6, 9, forearmHeight - 1)
    part(3, gloveX - 1, gloveY + 8, 3, Math.min(6, forearmHeight - 2))
  }
  part(0, gloveX - 2, gloveY - 2, 14, 13)
  part(0, gloveX + 9, gloveY + 1, 6, 8)
  part(2, gloveX, gloveY, 12, 9)
  part(3, gloveX + 2, gloveY, 9, 6)
  part(3, gloveX + 11, gloveY + 2, 3, 5)
  part(4, gloveX + 3, gloveY, 8, 2)
  part(1, gloveX + 7, gloveY + 4, 1, 4)

  if (bossGrowth >= 0.45) {
    part(0, 8, -50, 15, 8)
    part(2, 9, -49, 13, 6)
    part(4, 20, -48, 3, 4)
  }
  if (action === laserCharging || action === laserFiring || hoveringLaser) {
    const direction = facesRight ? 1 : -1
    const reach = hoveringLaser ? Math.min(laserRange, Math.abs(targetX - x)) : laserRange
    const end = x + reach * direction
    const firing = action === laserFiring || action === hoverFiring
    const eyeY = bootY + scaled(headY + 8)
    const cannonY = bootY + scaled(-45)
    drawLaser(rect, x + scaled(8) * direction, eyeY, end, hoveringLaser ? playerEyeY : eyeY, firing)
    drawLaser(rect, x + scaled(22) * direction, cannonY, end, hoveringLaser ? floor - 47 : cannonY, firing)
  }
  if (action === teleportCharging || action === teleportArriving) {
    const rim = action === teleportArriving ? 27 : 21
    mark("#368a97", -rim, -65, 3, 65)
    mark("#368a97", rim - 3, -65, 3, 65)
    mark("#93f1df", -rim, -1, rim * 2, 2)
    mark("#93f1df", -rim + 4, -70, rim * 2 - 8, 2)
  }
  if (windingUp) {
    rect("#ffcf80", x + (facesRight ? 7 : -10), floor - 70, 3, 3)
  }
  if (reeling) {
    const spark = x + (facesRight ? 15 : -15)
    rect("#faab53", spark - 1, floor - 60, 3, 11)
    rect("#ffe8aa", spark - 5, floor - 56, 11, 3)
    rect("#fff5d6", spark - 1, floor - 56, 3, 3)
  }
}

function drawBoots(part, mark, thrust) {
  for (const heel of [-16, 4]) {
    part(1, heel, -6, 9, 6)
    part(4, heel + 2, -4, 5, 2)
    if (thrust) {
      mark("#dc592d", heel + 1, 0, 7, 8)
      mark("#f9a054", heel + 2, 0, 5, 6)
      mark("#fff0ac", heel + 3, 0, 3, 3)
    }
  }
}

function drawWings(part, mark) {
  part(0, -15, -66, 30, 37)
  part(1, -13, -64, 26, 30)
  part(0, 9, -67, 18, 9)
  part(0, 7, -58, 15, 9)
  part(2, 11, -65, 14, 5)
  part(3, 13, -64, 11, 1)
  part(0, -39, -70, 14, 11)
  part(0, -34, -64, 22, 13)
  part(0, -28, -52, 19, 12)
  part(0, -21, -41, 13, 10)
  part(2, -37, -68, 11, 7)
  part(2, -32, -62, 18, 9)
  part(2, -26, -51, 15, 7)
  part(3, -35, -67, 8, 2)
  part(3, -30, -59, 13, 2)
  mark("#ffc371", -37, -68, 4, 2)
}

function drawLaser(rect, origin, y, end, endY, firing) {
  rect("#8834a7", origin - 4, y - 4, 9, 9)
  rect("#e591ff", origin - 2, y - 2, 5, 5)
  rect("#fff1ff", origin - 1, y - 1, 3, 3)
  if (!firing) return

  const start = Math.min(origin, end)
  const width = Math.abs(end - origin)
  if (width === 0) return
  const direction = Math.sign(end - origin)
  const slope = (endY - y) / width
  const chunk = endY === y ? width : 4
  for (let offset = 0; offset < width; offset += chunk) {
    const length = Math.min(chunk, width - offset)
    const x = direction > 0 ? start + offset : origin - offset - length
    const line = Math.round(y + offset * slope)
    rect("#8834a7", x, line - 3, length, 7)
    rect("#e591ff", x, line - 1, length, 3)
    rect("#fff1ff", x, line, length, 1)
  }
}
