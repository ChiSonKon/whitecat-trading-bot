package scanner

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
)

// Uniswap V2 PairCreated Topic0:
// keccak256("PairCreated(address,address,address,uint256)")
const UniswapV2PairCreatedTopic = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9"

type NewPoolEvent struct {
	Chain        string    `json:"chain"`
	PairAddress  string    `json:"pair_address"`
	Token0       string    `json:"token0"`
	Token1       string    `json:"token1"`
	BlockNumber  uint64    `json:"block_number"`
	DetectedAt   time.Time `json:"detected_at"`
	IsRobinhood  bool      `json:"is_robinhood"`
	MemeDetected bool      `json:"meme_detected"`
}

type PoolScanner struct {
	Chain   string
	WssURL  string
	OnEvent func(event NewPoolEvent)
}

func NewPoolScanner(chain string, wssURL string, onEvent func(event NewPoolEvent)) *PoolScanner {
	return &PoolScanner{
		Chain:   chain,
		WssURL:  wssURL,
		OnEvent: onEvent,
	}
}

func (s *PoolScanner) Start(ctx context.Context) {
	log.Printf("[Scanner] 🚀 正在启动 [%s] 新池毫秒级监听器 (WSS: %s)...", s.Chain, s.WssURL)

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	var simulatedBlock uint64 = 1452900

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Scanner] [%s] 监听器已停止。", s.Chain)
			return
		case <-ticker.C:
			simulatedBlock++
			// 模拟检测到开盘新池事件
			if simulatedBlock%4 == 0 {
				tokenA := "0x4200000000000000000000000000000000000006" // WETH
				tokenB := fmt.Sprintf("0x%040x", simulatedBlock*999)
				pair := fmt.Sprintf("0x%040x", simulatedBlock*12345)

				event := NewPoolEvent{
					Chain:        s.Chain,
					PairAddress:  pair,
					Token0:       tokenA,
					Token1:       tokenB,
					BlockNumber:  simulatedBlock,
					DetectedAt:   time.Now(),
					IsRobinhood:  strings.ToLower(s.Chain) == "robinhood",
					MemeDetected: true,
				}

				log.Printf("🔥 [SCANNER ALERT] [%s] 捕获新开盘流动性池! Pair: %s, 目标代币: %s",
					strings.ToUpper(s.Chain), event.PairAddress[:10]+"...", event.Token1[:10]+"...")

				if s.OnEvent != nil {
					s.OnEvent(event)
				}
			}
		}
	}
}

func (e *NewPoolEvent) ToJSON() string {
	b, _ := json.Marshal(e)
	return string(b)
}
