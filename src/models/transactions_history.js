const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TransactionsHistory extends Model {
    static associate(models) {
      // define association here
    }
  };
  TransactionsHistory.init({
    address: DataTypes.STRING,
    contract: DataTypes.STRING,
    content: DataTypes.JSONB,
    created_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'TransactionsHistory',
    tableName: 'transactions_history',
    timestamps: false,
  });
  return TransactionsHistory;
};
