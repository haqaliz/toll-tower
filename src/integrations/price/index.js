const axios = require('axios');
const _ = require('lodash');
const coinbase = axios.create({ baseURL: 'https://api.coinbase.com/v2/' });;

module.exports = {
  get: async (currency = 'usd') => {
    return _.get(
      await coinbase.get(`prices/ETH-${currency.toUpperCase()}/spot`),
      'data.data',
    );
  },
};
