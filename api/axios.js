const axios = require("axios");
require("dotenv").config();

const getTop10Url = "https://min-api.cryptocompare.com/data/top/totaltoptiervolfull?limit=10&tsym=USD";

// Получение цены криптовалюты по тикеру
function getCurrency(currency) {
	return axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${encodeURI(currency)}&tsyms=USD&api_key=${process.env.API_KEY}`).then((res) => {
		if (res.data.Response !== "Error") {
			return res.data.USD;
		} else {
			throw new Error("Error! Currency not found.");
		}
	});
}

// Получение цен криптовалют по тикерам
function getAllPrice(currencies) {
	return axios.get(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${currencies}&tsyms=USD&api_key=${process.env.API_KEY}`).then((res) => res.data);
}

// Получение списка топ-10 криптовалют
function getTop10() {
	return axios.get(getTop10Url).then((res) => {
		if (res.data.Message == "Success") {
			const top10 = [];
			for (let i = 0; i < 2; i++) {
				top10.push([
					res.data.Data[i * 5].CoinInfo.Name,
					res.data.Data[i * 5 + 1].CoinInfo.Name,
					res.data.Data[i * 5 + 2].CoinInfo.Name,
					res.data.Data[i * 5 + 3].CoinInfo.Name,
					res.data.Data[i * 5 + 4].CoinInfo.Name,
				]);
			}
			top10.push(["Отмена"]);
			return top10;
		} else {
			throw new Error("Error! Top 10 not found.");
		}
	});
}

module.exports.getCurrency = getCurrency;
module.exports.getTop10 = getTop10;
module.exports.getAllPrice = getAllPrice;
