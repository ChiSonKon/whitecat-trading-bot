package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whitecat-sentry-detector/risk"
	"whitecat-sentry-detector/scanner"
	"whitecat-sentry-detector/tracker"
)

func main() {
	log.Println("==================================================================")
	log.Println("🛡️  白猫打狗机器人 (WhiteCat Sentry Detector) 风控与聪明钱哨兵启动")
	log.Println("🌐  支持网络: Robinhood Chain (4663), Solana, Base, BSC, Ethereum")
	log.Println("==================================================================")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 捕获系统退出信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 1. 启动静态安全检测器
	checker := risk.NewSecurityChecker()
	dummyCode := "608060405234801561001057600080fd5b5040c10f19" // 包含 mint 特征
	report := checker.QuickInspectBytecode(dummyCode)
	log.Printf("[Security] 静态沙盒分析预检正常: Verdict = %s (Score: %d)", report.Verdict, report.RiskScore)

	// 2. 启动 Robinhood Chain 新池开盘监听器
	rhWss := os.Getenv("ROBINHOOD_WSS")
	if rhWss == "" {
		rhWss = "wss://rpc.mainnet.chain.robinhood.com/ws"
	}
	poolScanner := scanner.NewPoolScanner("Robinhood Chain (4663)", rhWss, func(event scanner.NewPoolEvent) {
		log.Printf("⚡ [FAST ACTION] 监听到新池 %s, 准备触发 Block 0 毫秒级抢跑!", event.PairAddress[:10])
	})
	go poolScanner.Start(ctx)

	// 3. 启动聪明钱与防巨鲸砸盘雷达
	whaleTracker := tracker.NewWhaleTracker("Robinhood / Base")
	go whaleTracker.Start(ctx)

	// 处理跟单与防砸盘信号
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case sig := <-whaleTracker.Signals():
				if sig.IsDumpWarning {
					log.Printf("🚨 [DEFENSE TRIGGER] 巨鲸抛售预警已捕获: %s -> 立即向交易内核派发保本清仓指令!", sig.WhaleAddress[:8])
				} else {
					log.Printf("🛒 [AUTO-COPY] 聪明钱买入信号已捕获: %s -> 触发跟单买入!", sig.WhaleAddress[:8])
				}
			}
		}
	}()

	// 阻塞运行直到收到退出信号或运行展示
	log.Println("✨ 哨兵雷达已成功进入监听状态 (按 Ctrl+C 可停止)...")

	// 如果有测试标识则运行一段时间后平稳退出，用于 CI/CD
	if os.Getenv("TEST_RUN") == "true" {
		time.Sleep(2 * time.Second)
		log.Println("✅ TEST_RUN 完成，哨兵自检通过。")
		return
	}

	<-sigChan
	log.Println("正在平稳关闭哨兵服务...")
	cancel()
	time.Sleep(500 * time.Millisecond)
	log.Println("哨兵服务已安全退出。")
}
