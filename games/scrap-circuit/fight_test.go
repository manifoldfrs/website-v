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

func TestOpponentUnlocksLaserInRoundFour(t *testing.T) {
	for round := 1; round <= 5; round++ {
		match := newFight(0, round)
		match.fighters[0].x, match.fighters[1].x = 100, 175
		match.step(0)
		if charging := match.fighters[1].action == laserCharging; charging != (round >= 4) {
			t.Fatalf("round %d: charging = %t", round, charging)
		}
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
