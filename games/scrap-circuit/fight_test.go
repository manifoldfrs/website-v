package main

import "testing"

func TestFightDamageAndReset(t *testing.T) {
	match := newFight(1)
	blue, red := &match.fighters[0], &match.fighters[1]

	for range 14 {
		match.step(punch)
	}
	if red.health != 100 {
		t.Fatal("a punch landed across the arena")
	}

	match = newFight(1)
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
	match = newFight(2)
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
			match := newFight(1)
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
