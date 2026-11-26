package main

import (
	"math/rand"
)

const (
	left = 1 << iota
	right
	punch
	guard
)

const (
	ready = iota
	windup
	strike
	recovering
	blocking
	staggered
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
)

type fighter struct {
	x      float64
	health int
	action int
	ticks  int
}

type fight struct {
	fighters [2]fighter
	result   int
	cpuWait  int
	random   *rand.Rand
}

func newFight(seed int64) fight {
	return fight{
		fighters: [2]fighter{
			{x: 70, health: 100},
			{x: 186, health: 100},
		},
		random: rand.New(rand.NewSource(seed)),
	}
}

func (f *fight) step(input int) {
	if f.result != playing {
		return
	}
	blue, red := &f.fighters[0], &f.fighters[1]
	cpu := f.cpuInput(red, blue)
	blue.advance(input, 1.45, 9)
	red.advance(cpu, 1.1, 17)
	const gap = 24
	if red.x-blue.x < gap {
		center := min(rightWall-gap/2, max(leftWall+gap/2, (blue.x+red.x)/2))
		blue.x, red.x = center-gap/2, center+gap/2
	}
	if red.x-blue.x <= punchRange {
		blueHit := blue.action == strike && blue.ticks == 3
		redHit := red.action == strike && red.ticks == 3
		if blueHit {
			red.hit(17)
		}
		if redHit {
			blue.hit(14)
		}
	}

	switch {
	case blue.health == 0 && red.health == 0:
		f.result = draw
	case blue.health == 0:
		f.result = cpuWins
	case red.health == 0:
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
	if cpu.x-player.x <= punchRange-4 {
		if f.cpuWait > 0 {
			return 0
		}
		f.cpuWait = 15 + f.random.Intn(15)
		if player.action == windup && f.random.Intn(3) == 0 {
			return guard
		}
		return punch
	}
	return left
}
