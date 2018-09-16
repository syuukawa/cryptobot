import Cryptopia from 'cryptopia-api';

import MovingAverage from './strategies/moving-average';
import config from './config/config';

process.on('unhandledRejection', error => {
	console.log('unhandledRejection:', error);
	process.exit();
});

// fee is a portion of the base (BTC) added to the cost of buy's, and removed from the return of sell's
let fees = {
	cryptopia: 0.002,
};

let exchange = Cryptopia();

const currentStrategy = MovingAverage;

exchange.setOptions(config);

let btcAmount = 0;
let initialBtcAmount = 0;
let coinAmount = 0;
let coin = 'ETH';

exchange.getBalance({
	Currency: 'BTC'
}).then(response => {
	initialBtcAmount = btcAmount = response.Data[0].Available;
	logBalance();
	main();
});

function logBalance() {
	if (coinAmount == 0) {
		let profit = Math.round((btcAmount - initialBtcAmount) * 100000000); // 10e8
		console.log(`Current balance: ${btcAmount.toFixed(8)} BTC, ${coinAmount.toFixed(8)} ${coin}, profit: ${profit.toLocaleString('en')} Satoshi (roughly ${profit / 10000} NZD)`);
	} else {
		console.log(`Current balance: ${btcAmount.toFixed(8)} BTC, ${coinAmount.toFixed(8)} ${coin}`);
	}
}

async function main() {
	let period = 1000;
	let pair = `${coin}_BTC`;

	// amount of ETH to buy/sell per trade
	let tradeAmount = 0.001;

	let isUsingHistoricalData = true;
	let historicalDays = 100; // cryptopia caps at 1000 rows
	let historicalData = await exchange.getMarketHistory({Market: pair, Hours: 24 * historicalDays});
	let historicalRowNumber = 0;

	// { id: 1, price: 3, amount: 0.001, feeRate: 0.002, total: (3 * 0.001) - 0.00006, type: 'buy' }
	let pendingTrade = null;
	let calcFee = function(trade) {
		return trade.price * trade.amount * trade.feeRate;
	}
	let calcBase = function(trade) {
		return trade.price * trade.amount - calcFee(trade);
	}

	let getValue = async function() {
		if (isUsingHistoricalData)
			return await getHistoricalValue();
		else
			return await getLiveValue();
	}

	let getLiveValue = async function() {
		let response = await exchange.getMarket({Market: pair});
		let currentValue = response.Data.LastPrice;
		return currentValue;
	}

	let getHistoricalValue = async function() {
		return historicalData.Data[historicalRowNumber++].Price;
	}

	let update = async function() {
		if (isUsingHistoricalData && historicalRowNumber >= historicalData.Data.length) {
			console.log(`End of historical data. Initial holdings: ${initialBtcAmount} BTC, 0 ${coin}`);
			console.log(`Final holdings: ${btcAmount} BTC, ${coinAmount} ${coin}`);
			console.log(`Difference: ${btcAmount - initialBtcAmount} BTC, ${coinAmount} ${coin}`);
			return;
		}

		let currentValue = await getValue();
		let action = trader.update(currentValue);

		switch (action) {
			case 'sell': // sell all coin at this price
				if (coinAmount <= 0) {
					console.log('None left to sell');
					break;
				}
				if (!isUsingHistoricalData) {
					let currentTradeId = await exchange.submitTrade({
						Market: pair,
						Type: 'Sell',
						Rate: currentValue,
						Amount: coinAmount,
					});
					pendingTrade = {
						id: currentTradeId,
						price: currentValue,
						amount: coinAmount,
						feeRate: fees.cryptopia,
						type: 'sell',
					};
				} else {
					pendingTrade = {
						id: -1,
						price: currentValue,
						amount: coinAmount,
						feeRate: fees.cryptopia,
						type: 'sell',
					};
				}
				btcAmount += calcBase(pendingTrade);
				coinAmount = 0;
				console.log(`Sell at ${currentValue}`);
				break;
			case 'buy': // buy tradeAmount coin at this price
				if (btcAmount <= 0) {
					console.log('No BTC left to buy with');
					break;
				}
				if (!isUsingHistoricalData) {
					let currentTradeId = exchange.submitTrade({
						Market: pair,
						Type: 'Buy',
						Rate: currentValue,
						Amount: tradeAmount,
					});
					pendingTrade = {
						id: currentTradeId,
						price: currentValue,
						amount: tradeAmount,
						feeRate: fees.cryptopia,
						type: 'buy',
					};
				} else {
					pendingTrade = {
						id: -1,
						price: currentValue,
						amount: tradeAmount,
						feeRate: fees.cryptopia,
						type: 'buy',
					};
				}
				coinAmount += pendingTrade.amount;
				btcAmount -= calcBase(pendingTrade);

				console.log(`Buy at ${currentValue}`);
				break;
			case 'exit sell': // cancel the last sell order
				if (pendingTrade == null) {
					console.log('No sell trade to cancel');
					break;
				}
				if (!isUsingHistoricalData) {
					exchange.cancelTrade({
						Type: 'Trade',
						OrderId: pendingTrade.id,
					});
				}
				coinAmount += pendingTrade.amount;
				btcAmount -= calcBase(pendingTrade);
				pendingTrade = null;

				console.log('Exit sell');
				break;
			case 'exit buy': // cancel the last buy order
				if (pendingTrade == null) {
					console.log('No buy trade to cancel');
					break;
				}
				if (!isUsingHistoricalData) {
					exchange.cancelTrade({
						Type: 'Trade',
						OrderId: pendingTrade.id,
					});
				}
				coinAmount -= pendingTrade.amount;
				btcAmount += calcBase(pendingTrade);
				pendingTrade = null;

				console.log('Exit buy');
				break;
			case 'hold': // keep current holdings
				console.log('Hold');
				break;
			case 'sell closed': // mark last sell order as complete
				pendingTrade = null;
				console.log('Sell closed');
				break;
			case 'buy closed': // mark last buy order as complete
				pendingTrade = null;
				console.log('Buy closed');
				break;
			default: // unexpected result
				console.log(`Couldn't decipher action: ${action}`);
				break;
		}

		logBalance();

		setTimeout(update, !isUsingHistoricalData ? period : 0);
	};

	// only give strategy the public api functions
	let trader = new currentStrategy({
		getCurrencies: exchange.getCurrencies,
		getTradePairs: exchange.getTradePairs,
		getMarkets: exchange.getMarkets,
		getMarket: exchange.getMarket,
		getMarketHistory: exchange.getMarketHistory,
		getMarketOrders: exchange.getMarketOrders,
		getMarketOrderGroups: exchange.getMarketOrderGroups,
	});

	setTimeout(update, isUsingHistoricalData ? period : 0);
}
