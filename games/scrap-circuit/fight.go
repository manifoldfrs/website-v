package main

import (
	"math/rand"
)

const (
	left = 1 << iota
	right
	punch
	guard
	laser
)

const (
	ready = iota
	windup
	strike
	recovering
	blocking
	staggered
	laserCharging
	laserFiring
)

const (
	playing = iota
	playerWins
	cpuWins
	draw
)

const (
	leftWall   = 30
	rightWall  = 226
	punchRange = 38
	laserRange = 108
)

const (
	laserChargeTicks   = 30
	laserFireTicks     = 10
	laserRecoveryTicks = 27
	laserCooldownTicks = 180
	laserDamage        = 24
)

type fighter struct {
	x      float64
	health int
	action int
	ticks  int
}

type cpuDifficulty struct {
	speed       float64
	windup      int
	attackDelay int
	damage      int
	laserRange  int
}

type fight struct {
	fighters  [2]fighter
	cpu       cpuDifficulty
	result    int
	cpuWait   int
	laserWait int
	random    *rand.Rand
}

func newFight(seed int64, round int) fight {
	wins := float64(max(1, round) - 1)
	pressure := wins / (wins + 6)
	beamRange := 0
	if round >= 4 {
		beamRange = laserRange
	}
	return fight{
		fighters: [2]fighter{
			{x: 70, health: 100},
			{x: 186, health: 100},
		},
		cpu: cpuDifficulty{
			speed:       1.1 + 0.9*pressure,
			windup:      17 - int(11*pressure),
			attackDelay: 15 - int(10*pressure),
			damage:      14 + int(11*pressure),
			laserRange:  beamRange,
		},
		random: rand.New(rand.NewSource(seed)),
	}
}

func (f *fight) step(input int) {
	if f.result != playing {
		return
	}
	f.laserWait = max(0, f.laserWait-1)
	player, cpu := &f.fighters[0], &f.fighters[1]
	cpuInput := f.cpuInput(cpu, player)
	player.advance(input&^laser, 1.45, 9)
	cpu.advance(cpuInput, f.cpu.speed, f.cpu.windup)
	const gap = 24
	if cpu.x-player.x < gap {
		center := min(rightWall-gap/2, max(leftWall+gap/2, (player.x+cpu.x)/2))
		player.x, cpu.x = center-gap/2, center+gap/2
	}
	if cpu.x-player.x <= punchRange {
		playerHit := player.action == strike && player.ticks == 3
		cpuHit := cpu.action == strike && cpu.ticks == 3
		if playerHit {
			cpu.hit(17)
		}
		if cpuHit {
			player.hit(f.cpu.damage)
		}
	}
	if cpu.action == laserFiring && cpu.ticks == laserFireTicks && cpu.x-player.x <= float64(f.cpu.laserRange) {
		player.hit(laserDamage)
	}

	switch {
	case player.health == 0 && cpu.health == 0:
		f.result = draw
	case player.health == 0:
		f.result = cpuWins
	case cpu.health == 0:
		f.result = playerWins
	}
}

func (p *fighter) advance(input int, speed float64, windupTicks int) {
	if p.ticks > 0 {
		p.ticks--
		if p.ticks > 0 {
			return
		}
		switch p.action {
		case windup:
			p.action, p.ticks = strike, 3
			return
		case strike:
			p.action, p.ticks = recovering, 19
			return
		case laserCharging:
			p.action, p.ticks = laserFiring, laserFireTicks
			return
		case laserFiring:
			p.action, p.ticks = recovering, laserRecoveryTicks
			return
		}
	}

	p.action = ready
	if input&guard != 0 {
		p.action = blocking
		return
	}
	if input&punch != 0 {
		p.action, p.ticks = windup, windupTicks
		return
	}
	if input&laser != 0 {
		p.action, p.ticks = laserCharging, laserChargeTicks
		return
	}

	direction := 0.0
	if input&left != 0 {
		direction--
	}
	if input&right != 0 {
		direction++
	}
	p.x = min(rightWall, max(leftWall, p.x+direction*speed))
}

func (p *fighter) hit(damage int) {
	if p.action == blocking {
		p.health = max(0, p.health-2)
		return
	}
	p.health = max(0, p.health-damage)
	p.action, p.ticks = staggered, 13
}

func (f *fight) cpuInput(cpu, player *fighter) int {
	if cpu.ticks > 0 {
		return 0
	}
	if f.cpuWait > 0 {
		f.cpuWait--
		if cpu.action == blocking {
			return guard
		}
	}
	distance := cpu.x - player.x
	if distance > punchRange && distance <= float64(f.cpu.laserRange) && f.laserWait == 0 {
		f.laserWait = laserCooldownTicks
		return laser
	}
	if distance <= punchRange-4 {
		if f.cpuWait > 0 {
			return 0
		}
		f.cpuWait = f.cpu.attackDelay + f.random.Intn(15)
		if player.action == windup && f.random.Intn(3) == 0 {
			return guard
		}
		return punch
	}
	return left
}
