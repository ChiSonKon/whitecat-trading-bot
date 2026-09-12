package tracker

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

type WhaleSignal struct {
	Chain         string    `json:"chain"`
	WhaleAddress  string    `json:"whale_address"`
	Action        string    `json:"action"` // "BUY" or "SELL"
	TokenAddress  string    `json:"token_address"`
	AmountNative  float64   `json:"amount_native"`
	IsDumpWarning bool      `json:"is_dump_warning"` // 巨鲸清仓出货砸盘预警
	DetectedAt    time.Time `json:"detected_at"`
}

type WhaleTracker struct {
	mu           sync.RWMutex
	chain        string
	watchList    map[string]string // address -> label
	signalChan   chan WhaleSignal
}

func NewWhaleTracker(chain string) *WhaleTracker {
	tracker := &WhaleTracker{
		chain:      chain,
		watchList:  make(map[string]string),
		signalChan: make(chan WhaleSignal, 100),
	}

	// 预设聪明钱巨鲸
	tracker.watchList["0x56178a0d5F301bAf6CF3c1Cd7bE0e3a6c2f90111"] = "PinkPunk 顶级跟单大户"
	tracker.watchList["0x71c8a62024b335340632d4b998144bf956d68b6a"] = "Robinhood 早期大鲸"

	return tracker
}

func (w *WhaleTracker) AddWatch(address, label string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.watchList[address] = label
	log.Printf("[Tracker] 成功添加聪明钱地址监控: %s (%s)", address, label)
}

func (w *WhaleTracker) Signals() <-chan WhaleSignal {
	return w.signalChan
}

func (w *WhaleTracker) Start(ctx context.Context) {
	log.Printf("[Tracker] 🐋 [%s] 聪明钱雷达已启动，当前监控 %d 个巨鲸地址...", w.chain, len(w.watchList))

	ticker := time.NewTicker(4 * time.Second)
	defer ticker.Stop()

	var counter int

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Tracker] [%s] 聪明钱雷达已关闭。", w.chain)
			return
		case <-ticker.C:
			counter++
			// 模拟聪明钱交易事件 (每 3 次买入，第 4 次模拟巨鲸出货触发防砸盘)
			w.mu.RLock()
			for addr, label := range w.watchList {
				isSell := counter%4 == 0
				action := "BUY"
				var amount float64 = 1.5
				if isSell {
					action = "SELL"
					amount = 3.8
				}

				sig := WhaleSignal{
					Chain:         w.chain,
					WhaleAddress:  addr,
					Action:        action,
					TokenAddress:  "0x1234567890abcdef1234567890abcdef12345678",
					AmountNative:  amount,
					IsDumpWarning: isSell,
					DetectedAt:    time.Now(),
				}

				if isSell {
					log.Printf("⚠️ [WHALE DUMP ALERT] 巨鲸 [%s - %s] 正在清仓砸盘! 抛售 %.2f ETH, 触发全员优先平仓保护!",
						label, addr[:8]+"...", amount)
				} else {
					log.Printf("🟢 [WHALE COPY SIGNAL] 聪明钱 [%s - %s] 大额买入 %.2f ETH, 广播跟单信号!",
						label, addr[:8]+"...", amount)
				}

				select {
				case w.signalChan <- sig:
				default:
				}
				break
			}
			w.mu.RUnlock()
		}
	}
}

func (w *WhaleTracker) FormatSignal(sig WhaleSignal) string {
	return fmt.Sprintf("[%s] %s %s %.2f ETH on %s", sig.Chain, sig.Action, sig.WhaleAddress[:8], sig.AmountNative, sig.TokenAddress[:8])
}
