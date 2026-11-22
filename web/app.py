import threading
from datetime import date
from pathlib import Path
from typing import Literal

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from cli.utils import detect_asset_type
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(
    title="TradingAgents",
    description="Mobile-friendly interface for TradingAgents research.",
)
_analysis_lock = threading.Lock()


class AnalysisRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    trade_date: date
    analysts: list[Literal["market", "social", "news", "fundamentals"]] = [
        "market",
        "social",
        "news",
        "fundamentals",
    ]
    debate_rounds: int = Field(default=1, ge=1, le=5)
    checkpoint: bool = False


@app.post("/api/analyze")
def analyze(request: AnalysisRequest):
    ticker = request.ticker.strip().upper()
    analysts = list(dict.fromkeys(request.analysts))
    asset_type = str(detect_asset_type(ticker)).lower()

    if asset_type == "crypto":
        analysts = [name for name in analysts if name != "fundamentals"]

    config = DEFAULT_CONFIG.copy()
    config["max_debate_rounds"] = request.debate_rounds
    config["checkpoint_enabled"] = request.checkpoint

    try:
        with _analysis_lock:
            graph = TradingAgentsGraph(
                selected_analysts=analysts,
                debug=False,
                config=config,
            )
            final_state, decision = graph.propagate(
                ticker,
                request.trade_date.isoformat(),
                asset_type=asset_type,
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "ticker": ticker,
        "trade_date": request.trade_date.isoformat(),
        "asset_type": asset_type,
        "decision": decision,
        "reports": {
            key: final_state.get(key)
            for key in (
                "market_report",
                "sentiment_report",
                "news_report",
                "fundamentals_report",
                "investment_plan",
                "trader_investment_plan",
                "final_trade_decision",
            )
            if isinstance(final_state, dict) and final_state.get(key)
        },
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="web")


def main():
    uvicorn.run("web.app:app", host="0.0.0.0", port=8000, reload=False)
