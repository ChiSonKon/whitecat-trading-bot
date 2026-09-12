package risk

import (
	"strings"
)

type TokenRiskReport struct {
	TokenAddress   string  `json:"token_address"`
	IsMintable     bool    `json:"is_mintable"`
	HasBlacklist   bool    `json:"has_blacklist"`
	TradingLocked  bool    `json:"trading_locked"`
	MaxTxRestricted bool   `json:"max_tx_restricted"`
	RiskScore      int     `json:"risk_score"` // 0 ~ 100 (越高越危险)
	Verdict        string  `json:"verdict"`    // SAFE, WARN, DANGEROUS, HONEYPOT
}

type SecurityChecker struct{}

func NewSecurityChecker() *SecurityChecker {
	return &SecurityChecker{}
}

// QuickInspectBytecode 静态分析 EVM 字节码
func (c *SecurityChecker) QuickInspectBytecode(bytecodeHex string) TokenRiskReport {
	code := strings.ToLower(bytecodeHex)

	report := TokenRiskReport{
		IsMintable:     strings.Contains(code, "40c10f19"), // mint(address,uint256)
		HasBlacklist:   strings.Contains(code, "f9f0868f") || strings.Contains(code, "blacklist"),
		TradingLocked:  strings.Contains(code, "enabletrading") || strings.Contains(code, "opentrading"),
		MaxTxRestricted: strings.Contains(code, "maxtxamount"),
	}

	score := 0
	if report.HasBlacklist {
		score += 45
	}
	if report.IsMintable {
		score += 30
	}
	if report.MaxTxRestricted {
		score += 15
	}
	if report.TradingLocked {
		score += 10
	}

	report.RiskScore = score

	if score >= 75 {
		report.Verdict = "HONEYPOT"
	} else if score >= 45 {
		report.Verdict = "DANGEROUS"
	} else if score >= 20 {
		report.Verdict = "WARN"
	} else {
		report.Verdict = "SAFE"
	}

	return report
}
