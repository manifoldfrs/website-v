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
	jump
	teleport
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
	rocketJump
	transforming
	teleportCharging
	teleportArriving
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
	laserChargeTicks      = 30
	laserFireTicks        = 10
	laserRecoveryTicks    = 27
	laserCooldownTicks    = 180
	laserDamage           = 24
	jumpTicks             = 30
	jumpPeak              = 30
	jumpLandingTicks      = 14
	jumpCooldownTicks     = 150
	punchReachHeight      = 12
	transformTicks        = 42
	teleportChargeTicks   = 20
	teleportArrivalTicks  = 18
	teleportCooldownTicks = 210
	teleportMinRange      = 62
	teleportGap           = 32
	guardReadTicks        = 5
	counterWindupBonus    = 4
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
	guardChance int
	damage      int
	laserRange  int
	rocketBoots bool
	maxHealth   int
	boss        bool
}

type fight struct {
	fighters     [2]fighter
	cpu          cpuDifficulty
	result       int
	cpuWait      int
	laserWait    int
	jumpWait     int
	teleportWait int
	random       *rand.Rand
}

func newFight(seed int64, round int) fight {
	wins := float64(max(1, round) - 1)
	pressure := wins / (wins + 6)
	match := fight{
		fighters: [2]fighter{
			{x: 70, health: 100},
			{x: 186, health: 100},
		},
		cpu: cpuDifficulty{
			speed:       1.1 + 0.9*pressure,
			windup:      17 - int(11*pressure),
			attackDelay: 11 - int(8*pressure),
			guardChance: 22 + int(50*pressure),
			damage:      14 + int(11*pressure),
			rocketBoots: round >= 3,
			maxHealth:   100,
		},
		random: rand.New(rand.NewSource(seed)),
	}
	if round < 4 {
		return match
	}

	match.cpu.boss = true
	match.cpu.laserRange = laserRange
	match.cpu.maxHealth = 135
	match.cpu.damage += 3
	match.cpu.guardChance += 16
	match.fighters[1].health = match.cpu.maxHealth
	match.teleportWait = 60
	if round == 4 {
		match.fighters[1].action, match.fighters[1].ticks = transforming, transformTicks
	}
	return match
}

func (f *fight) step(input int) {
	if f.result != playing {
		return
	}
	player, cpu := &f.fighters[0], &f.fighters[1]
	if cpu.action == transforming {
		cpu.advance(0, f.cpu.speed, f.cpu.windup)
		return
	}
	f.laserWait = max(0, f.laserWait-1)
	f.jumpWait = max(0, f.jumpWait-1)
	f.teleportWait = max(0, f.teleportWait-1)
	cpuInput := f.cpuInput(cpu, player)
	cpuWindup := f.cpu.windup
	if cpuInput == punch && player.action == recovering {
		cpuWindup = max(7, cpuWindup-counterWindupBonus)
	}
	player.advance(input&(left|right|punch|guard), 1.45, 9)
	cpu.advance(cpuInput, f.cpu.speed, cpuWindup)
	gap := 24.0
	if f.cpu.boss {
		gap = 30
	}
	if cpu.action == teleportArriving && cpu.ticks == teleportArrivalTicks {
		cpu.x = min(rightWall, player.x+teleportGap)
	}
	if cpu.x-player.x < gap {
		center := min(rightWall-gap/2, max(leftWall+gap/2, (player.x+cpu.x)/2))
		player.x, cpu.x = center-gap/2, center+gap/2
	}
	if cpu.x-player.x <= punchRange {
		playerHit := player.action == strike && player.ticks == 3 && cpu.height() < punchReachHeight
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
		case rocketJump:
			p.action, p.ticks = recovering, jumpLandingTicks
			return
		case teleportCharging:
			p.action, p.ticks = teleportArriving, teleportArrivalTicks
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
	if input&jump != 0 {
		p.action, p.ticks = rocketJump, jumpTicks
		return
	}
	if input&teleport != 0 {
		p.action, p.ticks = teleportCharging, teleportChargeTicks
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

func (p *fighter) height() int {
	if p.action != rocketJump {
		return 0
	}
	elapsed := jumpTicks - p.ticks
	return 4 * jumpPeak * elapsed * p.ticks / (jumpTicks * jumpTicks)
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
	distance := cpu.x - player.x
	if f.cpu.rocketBoots && f.jumpWait == 0 && distance <= punchRange && player.action == windup {
		f.jumpWait = jumpCooldownTicks
		return jump
	}
	if f.cpuWait > 0 {
		f.cpuWait--
	}
	if distance > punchRange && distance <= float64(f.cpu.laserRange) && f.laserWait == 0 {
		f.laserWait = laserCooldownTicks
		return laser
	}
	if f.cpu.boss && distance >= teleportMinRange && f.teleportWait == 0 {
		f.teleportWait = teleportCooldownTicks
		return teleport
	}
	if distance <= punchRange {
		if cpu.action == blocking && (player.action == windup || player.action == strike) {
			return guard
		}
		if player.action == windup {
			if f.cpuWait == 0 && player.ticks == guardReadTicks && f.random.Intn(100) < f.cpu.guardChance {
				return guard
			}
			return 0
		}
	}
	if distance <= punchRange-4 || (distance <= punchRange && player.action == recovering) {
		if f.cpuWait > 0 {
			return 0
		}
		f.cpuWait = f.cpu.attackDelay + f.random.Intn(15)
		return punch
	}
	return left
}
