const palettes = {
  blue: ["#111b34", "#1d385e", "#226d9a", "#36a2ca", "#9be8f9", "#e3fbff"],
  red: ["#301325", "#602238", "#9f343e", "#e15145", "#ffa483", "#ffeac9"],
}
const floor = 117
const laserCharging = 6
const laserFiring = 7

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

export function drawRobot(ctx, { x, health, action, color, facesRight, laserRange }) {
  const shades = palettes[color]
  const rect = painter(ctx)
  const part = (shade, dx, dy, w, h) => {
    rect(shades[shade], x + (facesRight ? dx : -dx - w), floor + dy, w, h)
  }

  const knockout = health === 0
  const punching = action === 2 && !knockout
  const guarding = action === 4 && !knockout
  const windingUp = action === 1 && !knockout
  const reeling = action === 5 && !knockout
  const recoil = reeling ? -3 : 0
  const headY = knockout ? -86 : reeling ? -70 : -65
  const gloveX = punching ? 29 : guarding ? 13 : windingUp ? -8 : 12
  const gloveY = guarding ? -54 : windingUp ? -41 : -45

  rect("#191420", x - 22, floor, 44, 4)
  part(0, -16, -27, 14, 21)
  part(0, 0, -29, 14, 23)
  part(1, -14, -24, 11, 17)
  part(2, -12, -22, 8, 13)
  part(0, -19, -9, 16, 10)
  part(2, -18, -8, 14, 6)
  part(3, -17, -8, 11, 2)

  part(1, 1, -28, 12, 23)
  part(2, 3, -25, 10, 16)
  part(3, 4, -22, 7, 7)
  part(4, 5, -21, 5, 2)
  part(0, 1, -10, 19, 11)
  part(2, 2, -9, 17, 7)
  part(3, 3, -9, 14, 2)

  part(0, -14, -50, 26, 24)
  part(0, -17, -45, 29, 14)
  part(1, -15, -46, 24, 17)
  part(2, -12, -49, 20, 18)
  part(3, -11, -48, 18, 6)
  part(4, -9, -48, 9, 2)
  part(1, -12, -31, 22, 5)
  part(3, -11, -31, 16, 2)

  part(0, -5 + recoil, headY + 13, 9, -headY - 60)
  for (let y = headY + 16; y < -52; y += 3) {
    part(4, -3 + recoil, y, 5, 1)
  }
  part(0, -13 + recoil, headY + 2, 23, 14)
  part(0, -10 + recoil, headY, 19, 3)
  part(2, -12 + recoil, headY + 2, 21, 11)
  part(3, -11 + recoil, headY + 2, 19, 4)
  part(4, -9 + recoil, headY + 2, 12, 1)
  part(1, -2 + recoil, headY + 6, 13, 4)
  part(5, 3 + recoil, headY + 7, 6, 2)
  part(3, 5 + recoil, headY + 11, 6, 3)
  part(1, -10 + recoil, headY + 7, 5, 5)
  part(4, -9 + recoil, headY + 8, 2, 2)

  part(0, -15, -47, 12, 21)
  part(0, -19, -43, 20, 13)
  part(0, -21, -40, 24, 7)
  part(2, -17, -44, 15, 15)
  part(2, -19, -41, 19, 9)
  part(3, -16, -44, 12, 3)
  part(4, -17, -42, 3, 2)
  part(3, -14, -41, 9, 8)
  part(1, -13, -40, 7, 6)
  part(4, -12, -39, 4, 2)

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
  part(0, gloveX - 2, gloveY - 2, 14, 14)
  part(2, gloveX, gloveY, 11, 10)
  part(3, gloveX, gloveY, 10, 6)
  part(4, gloveX + 2, gloveY, 7, 2)

  if (action === laserCharging || action === laserFiring) {
    const direction = facesRight ? 1 : -1
    const eyeX = x + 8 * direction
    const eyeY = floor + headY + 8
    rect("#8834a7", eyeX - 5, eyeY - 5, 11, 11)
    rect("#e591ff", eyeX - 3, eyeY - 3, 7, 7)
    rect("#fff1ff", eyeX - 1, eyeY - 1, 3, 3)
    if (action === laserFiring) {
      const end = x + laserRange * direction
      const start = Math.min(eyeX, end)
      const width = Math.abs(end - eyeX)
      rect("#8834a7", start, eyeY - 3, width, 7)
      rect("#e591ff", start, eyeY - 1, width, 3)
      rect("#fff1ff", start, eyeY, width, 1)
    }
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
