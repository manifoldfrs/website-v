package main

import "testing"

func TestFightDamageAndReset(t *testing.T) {
	match := newFight(1, 1)
	blue, red := &match.fighters[0], &match.fighters[1]

	for range 14 {
		match.step(punch)
	}
	if red.health != 100 {
		t.Fatal("a punch landed across the arena")
	}

	match = newFight(1, 1)
	blue.x, red.x = 110, 135
	match.cpuWait = 90
	for range 12 {
		match.step(punch)
	}
	if red.health != 83 {
		t.Fatalf("expected exactly one clean hit, red health is %d", red.health)
	}

	for range 400 {
		match.step(punch)
		if match.result != playing {
			break
		}
	}
	if match.result != playerWins || red.health != 0 {
		t.Fatalf("expected a blue win by knockout, got result %d with red health %d", match.result, red.health)
	}
	match = newFight(2, 1)
	if match.result != playing || match.fighters[0].health != 100 || match.fighters[1].health != 100 {
		t.Fatal("rematch did not reset both fighters")
	}
}

func TestGuardReducesDamage(t *testing.T) {
	for _, tc := range []struct {
		name  string
		input int
		want  int
	}{
		{name: "unguarded", want: 86},
		{name: "guarded", input: guard, want: 98},
	} {
		t.Run(tc.name, func(t *testing.T) {
			match := newFight(1, 1)
			blue, red := &match.fighters[0], &match.fighters[1]
			blue.x, red.x = 110, 135
			red.action, red.ticks = windup, 1
			match.step(tc.input)
			if blue.health != tc.want {
				t.Fatalf("blue health is %d, want %d", blue.health, tc.want)
			}
		})
	}
}

func TestSecondRoundOpponentClosesFasterAndHitsSooner(t *testing.T) {
	first := newFight(1, 1)
	second := newFight(1, 2)
	first.step(0)
	second.step(0)
	if second.fighters[1].x >= first.fighters[1].x {
		t.Fatal("round two opponent did not close the distance faster")
	}

	ticksUntilHit := func(match *fight) int {
		match.fighters[0].x, match.fighters[1].x = 110, 135
		for tick := 1; tick <= 30; tick++ {
			match.step(0)
			if match.fighters[0].health < 100 {
				return tick
			}
		}
		t.Fatal("opponent did not land a punch")
		return 0
	}
	firstHit, secondHit := ticksUntilHit(&first), ticksUntilHit(&second)
	if secondHit >= firstHit {
		t.Fatalf("round two hit at tick %d, round one at %d", secondHit, firstHit)
	}
	if second.fighters[0].health >= first.fighters[0].health {
		t.Fatal("round two punch did not deal more damage")
	}
}

func TestOpponentBlocksAReadAndCountersDuringRecovery(t *testing.T) {
	match := newFight(0, 1)
	match.cpu.guardChance = 100
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 100, 134
	player.action, player.ticks = windup, guardReadTicks

	for range guardReadTicks {
		match.step(0)
	}
	if cpu.health != 98 || cpu.action != blocking {
		t.Fatalf("read should block the punch, got health %d and action %d", cpu.health, cpu.action)
	}

	for range 4 {
		match.step(0)
	}
	if cpu.action != windup || cpu.ticks != match.cpu.windup-counterWindupBonus {
		t.Fatalf("expected a quick counter during recovery, got action %d and %d ticks", cpu.action, cpu.ticks)
	}
	for range match.cpu.windup - counterWindupBonus {
		match.step(0)
	}
	if player.health == 100 {
		t.Fatal("the counter did not catch the player in recovery")
	}
}

func TestOpponentStillLeavesAnOpeningAfterItsPunch(t *testing.T) {
	match := newFight(0, 1)
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 100, 134
	match.step(0)
	for range match.cpu.windup {
		match.step(guard)
	}
	if player.health != 98 {
		t.Fatal("guard did not absorb the opponent's attack")
	}
	for range 3 {
		match.step(0)
	}
	for range 10 {
		match.step(punch)
	}
	if cpu.health != 83 {
		t.Fatal("the player could not land a punch during the opponent's recovery")
	}
}

func TestOpponentUnlocksLaserInRoundFour(t *testing.T) {
	for round := 1; round <= 5; round++ {
		match := newFight(0, round)
		finishTransformation(&match)
		match.fighters[0].x, match.fighters[1].x = 100, 175
		match.step(0)
		if charging := match.fighters[1].action == laserCharging; charging != (round >= 4) {
			t.Fatalf("round %d: charging = %t", round, charging)
		}
	}
}

func TestRocketBootsUnlockAfterTwoWins(t *testing.T) {
	for round := 1; round <= 4; round++ {
		match := newFight(0, round)
		finishTransformation(&match)
		player, cpu := &match.fighters[0], &match.fighters[1]
		player.x, cpu.x = 100, 135
		match.step(punch)
		match.step(0)
		if jumping := cpu.action == rocketJump; jumping != (round >= 3) {
			t.Fatalf("round %d: jumping = %t", round, jumping)
		}
	}
}

func TestRocketJumpDodgesAPunchAndLeavesAnOpening(t *testing.T) {
	match := newFight(0, 3)
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 100, 135
	for range 10 {
		match.step(punch)
	}
	if cpu.height() < punchReachHeight || cpu.health != 100 {
		t.Fatalf("CPU did not dodge first punch: height=%d health=%d", cpu.height(), cpu.health)
	}

	for range 40 {
		match.step(punch)
		if cpu.health < 100 {
			break
		}
	}
	if cpu.height() != 0 || cpu.health != 83 {
		t.Fatalf("next punch did not connect after landing: height=%d health=%d", cpu.height(), cpu.health)
	}
}

func TestLaserWarnsForHalfASecondAndHitsOnce(t *testing.T) {
	for _, tc := range []struct {
		name  string
		input int
		want  int
	}{
		{name: "direct hit", want: 76},
		{name: "guard", input: guard, want: 98},
		{name: "move out of range", input: left, want: 100},
	} {
		t.Run(tc.name, func(t *testing.T) {
			match := newFight(0, 4)
			finishTransformation(&match)
			player, cpu := &match.fighters[0], &match.fighters[1]
			player.x, cpu.x = 110, 205
			match.step(tc.input)
			for range 29 {
				match.step(tc.input)
				if cpu.action != laserCharging || player.health != 100 {
					t.Fatal("laser fired before the 30-tick warning ended")
				}
			}
			match.step(tc.input)
			if cpu.action != laserFiring || player.health != tc.want {
				t.Fatalf("after firing: action %d, health %d, want %d", cpu.action, player.health, tc.want)
			}
			for range laserFireTicks - 1 {
				match.step(tc.input)
			}
			if player.health != tc.want {
				t.Fatal("the same laser dealt damage twice")
			}
		})
	}
}

func TestBossTransformationRunsBeforeCombat(t *testing.T) {
	third, fourth, fifth := newFight(0, 3), newFight(0, 4), newFight(0, 5)
	if third.cpu.boss || third.fighters[1].health != 100 {
		t.Fatal("boss appeared before three wins")
	}
	if fourth.fighters[1].action != transforming || fifth.fighters[1].action == transforming || !fifth.cpu.boss {
		t.Fatal("the intro should play once when the boss first unlocks")
	}
	if fourth.fighters[1].health <= third.fighters[1].health || fourth.cpu.damage <= third.cpu.damage {
		t.Fatal("the boss should have more health and hit harder")
	}
	before := fourth.fighters[0]
	for tick := 1; tick <= transformTicks; tick++ {
		fourth.step(right | punch)
		if fourth.fighters[0] != before || fourth.fighters[1].x != 186 {
			t.Fatal("combat advanced during the transformation")
		}
		if tick < transformTicks && fourth.fighters[1].action != transforming {
			t.Fatal("transformation ended early")
		}
	}
	fourth.step(right)
	if fourth.fighters[0].x <= before.x {
		t.Fatal("controls did not resume after the intro")
	}
}

func TestOpponentUnlocksTeleportInRoundThree(t *testing.T) {
	for round := 1; round <= 3; round++ {
		match := newFight(0, round)
		teleported := false
		for range 70 {
			match.step(0)
			if match.fighters[1].action == teleportArriving {
				teleported = true
				break
			}
		}
		if teleported != (round == 3) {
			t.Fatalf("round %d: teleported = %t", round, teleported)
		}
	}
}

func TestOpponentTeleportsAfterWarningWithoutCrossingPlayer(t *testing.T) {
	match := newFight(0, 3)
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 90, 185
	match.teleportWait = 0
	match.step(0)
	for range teleportChargeTicks - 1 {
		match.step(left)
		if cpu.action != teleportCharging || cpu.x != 185 {
			t.Fatal("opponent teleported before the warning ended")
		}
	}
	match.step(left)
	if cpu.action != teleportArriving || cpu.x != player.x+teleportGap || player.health != 100 {
		t.Fatalf("expected a non-damaging teleport toward the player's current position, got x=%v, player x=%v, hp=%d", cpu.x, player.x, player.health)
	}
	if match.teleportWait <= 0 {
		t.Fatal("teleport did not consume its cooldown")
	}
}

func TestOpponentTeleportsOutOfPunchRange(t *testing.T) {
	match := newFight(0, 3)
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 100, 135
	match.jumpWait, match.teleportWait = 100, 0
	match.step(punch)
	startX := cpu.x
	for range teleportRetreatTicks {
		match.step(0)
		if cpu.action != teleportRetreating || cpu.x != startX {
			t.Fatal("expected a brief flash before the opponent teleported away")
		}
	}
	match.step(0)
	if cpu.action != teleportArriving || cpu.x-player.x <= punchRange || match.teleportWait == 0 {
		t.Fatal("expected the opponent to teleport out of punching range and use its cooldown")
	}
	for player.action == windup {
		match.step(0)
	}
	if player.action != strike || cpu.health != 100 {
		t.Fatal("the punch should miss after the opponent teleports away")
	}
}

func TestOpponentOnlyTeleportsAwayWhenMoveIsAvailable(t *testing.T) {
	for _, tc := range []struct {
		name  string
		round int
		x     float64
		wait  int
	}{
		{name: "locked", round: 2, x: 100},
		{name: "cornered", round: 3, x: rightWall - punchRange},
		{name: "cooldown", round: 3, x: 100, wait: teleportCooldownTicks},
	} {
		t.Run(tc.name, func(t *testing.T) {
			match := newFight(0, tc.round)
			player, cpu := &match.fighters[0], &match.fighters[1]
			player.x, cpu.x = tc.x, tc.x+35
			match.jumpWait, match.teleportWait = 100, tc.wait
			match.step(punch)
			for player.action == windup {
				match.step(0)
				if cpu.action == teleportRetreating || cpu.action == teleportArriving {
					t.Fatal("opponent should stay within punching range")
				}
			}
		})
	}
}

func TestBossKeepsItsFormAndUnlocksAirborneLasersInRoundSix(t *testing.T) {
	for _, round := range []int{4, 5, 6, 7, 25} {
		match := newFight(0, round)
		finishTransformation(&match)
		player, cpu := &match.fighters[0], &match.fighters[1]
		if !match.cpu.boss || cpu.health != 135 {
			t.Fatalf("round %d lost the boss form", round)
		}
		player.x, cpu.x = 90, 185
		match.step(0)
		want := laserCharging
		if round == 6 || round == 7 {
			want = hoverCharging
		}
		if cpu.action != want {
			t.Fatalf("round %d: got action %d, want %d", round, cpu.action, want)
		}
	}
}

func TestRoundEightAlternatesQuickGroundAndAirLasers(t *testing.T) {
	seventh, match := newFight(0, 7), newFight(0, 8)
	if match.cpu.speed <= seventh.cpu.speed || match.cpu.windup >= seventh.cpu.windup || match.cpu.attackDelay >= seventh.cpu.attackDelay {
		t.Fatal("round eight should move and counter faster than round seven")
	}
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 90, 125
	previousAction, lastShot := ready, -1
	var shots, intervals, warnings []int
	chargeStart := -1
	for tick := 0; tick < 270 && len(shots) < 3; tick++ {
		match.step(guard)
		if cpu.action != previousAction {
			switch cpu.action {
			case laserCharging, hoverCharging:
				chargeStart = tick
			case laserFiring, hoverFiring:
				shots = append(shots, cpu.action)
				warnings = append(warnings, tick-chargeStart)
				if lastShot >= 0 {
					intervals = append(intervals, tick-lastShot)
				}
				lastShot = tick
			}
		}
		previousAction = cpu.action
	}
	if len(shots) != 3 || shots[0] != laserFiring || shots[1] != hoverFiring || shots[2] != laserFiring {
		t.Fatalf("expected ground, air, ground, got %v", shots)
	}
	for _, warning := range warnings {
		if warning != laserChargeTicks {
			t.Fatalf("expected the half-second warning, got %d ticks", warning)
		}
	}
	for _, interval := range intervals {
		if interval < rapidLaserCooldown || interval >= laserCooldownTicks {
			t.Fatalf("expected quicker attacks, got %d ticks between shots", interval)
		}
	}
}

func TestAirborneLaserWarnsFiresAndLands(t *testing.T) {
	match := newFight(0, 6)
	player, cpu := &match.fighters[0], &match.fighters[1]
	player.x, cpu.x = 90, 185
	match.step(0)
	for range laserChargeTicks - 1 {
		match.step(0)
		if cpu.action != hoverCharging || player.health != 100 {
			t.Fatal("airborne laser hit before the warning ended")
		}
	}
	if cpu.height() != hoverHeight {
		t.Fatal("boss did not rise during the warning")
	}
	match.step(guard)
	if cpu.action != hoverFiring || cpu.height() != hoverHeight || player.health != 98 {
		t.Fatal("boss did not fire while airborne or guard did not reduce damage")
	}
	for range laserFireTicks {
		match.step(0)
	}
	if cpu.action != hoverLanding || player.health != 98 {
		t.Fatal("the burst did not finish cleanly or dealt damage twice")
	}
	for range hoverLandingTicks {
		match.step(0)
	}
	if cpu.action != recovering || cpu.height() != 0 {
		t.Fatal("boss did not land before recovery ended")
	}
}

func finishTransformation(match *fight) {
	for match.fighters[1].action == transforming {
		match.step(0)
	}
}
