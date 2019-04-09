import * as React from 'react';
import ccxt from 'ccxt';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import Select from 'react-select';
import { Button } from '@material-ui/core';

class ExchangeTrader extends React.Component<{ exchange: string | null }, {}> {
	public title = 'Cryptobot';

	public state: {
		exchange: string | null;
		markets: ccxt.Market[];
		market: ccxt.Market | null;
	} = {
		exchange: null,
		markets: [],
		market: null,
	};

	public trader: ccxt.Exchange = new ccxt.poloniex();
	public algorithms: ({ name: string; execute: () => any })[] = [];
	public priceHistory: any[] = [];

	constructor(props: Readonly<{ exchange: string | null }>) {
		super(props);

		this.onExchangeChange = this.onExchangeChange.bind(this);
		this.onMarketChange = this.onMarketChange.bind(this);
		this.resetScreen = this.resetScreen.bind(this);
	}

	onExchangeChange(option: any) {
		const exchange = option.value;

		this.setState({
			exchange,
		});

		this.trader = new ccxt[exchange]();
		this.trader.loadMarkets().then(markets => {
			this.setState({
				markets,
			});
		});
	}

	onMarketChange(option: any) {
		const market = option.value;
		this.trader.fetchTrades(market).then(trades => {
			console.log(trades);
		});

		this.setState({
			market,
		});
	}

	resetScreen() {
		this.setState({
			exchange: null,
			markets: [],
			market: null,
		});
	}

	getHeader() {
		return [this.title, this.state.exchange, this.state.market].filter(x => x !== null).join(' - ');
	}

	renderScreen() {
		if (this.state.exchange === null) {
			const exchangeOptions = ccxt.exchanges.map(id => {
				return { value: id, label: id };
			});
			return (
				<div>
					<Typography variant="body2" component="div">
						Please select an exchange
					</Typography>
					<Select
						key="exchange-options"
						options={exchangeOptions}
						isSearchable={true}
						isClearable={true}
						onChange={this.onExchangeChange}
					/>
				</div>
			);
		} else if (this.state.market === null) {
			const marketOptions = Object.getOwnPropertyNames(this.state.markets).map(market => {
				return { value: this.state.markets[market].symbol, label: this.state.markets[market].symbol };
			});
			return (
				<div>
					<Typography variant="body2" component="div">
						Please select a market
					</Typography>
					<Select
						key="market-options"
						options={marketOptions}
						isSearchable={true}
						isClearable={true}
						onChange={this.onMarketChange}
					/>
				</div>
			);
		} else {
			return <div>Hello world!</div>;
		}
	}

	public render() {
		return (
			<Paper className="main">
				<Typography variant="h2" component="h1" style={{ lineHeight: 1.2 }}>
					{this.getHeader()}
				</Typography>
				{this.renderScreen()}
				<Button onClick={this.resetScreen}>Reset</Button>
			</Paper>
		);
	}
}

export default ExchangeTrader;
