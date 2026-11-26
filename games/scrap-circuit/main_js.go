package main

import "syscall/js"

func main() {
	var current fight
	var frame [8]byte

	publish := func(target js.Value) {
		for i, robot := range current.fighters {
			base := i * 3
			frame[base] = byte(robot.x)
			frame[base+1] = byte(robot.health)
			frame[base+2] = byte(robot.action)
		}
		frame[6] = byte(current.result)
		frame[7] = byte(current.cpu.laserRange)
		js.CopyBytesToJS(target, frame[:])
	}

	js.Global().Set("resetScrapCircuit", js.FuncOf(func(_ js.Value, args []js.Value) any {
		round := 1
		if len(args) > 2 {
			round = args[2].Int()
		}
		current = newFight(int64(args[0].Int()), round)
		publish(args[1])
		return nil
	}))
	js.Global().Set("stepScrapCircuit", js.FuncOf(func(_ js.Value, args []js.Value) any {
		current.step(args[0].Int())
		publish(args[1])
		return nil
	}))
	select {}
}
