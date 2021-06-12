const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Assets extends Model {
    static associate(models) {
    }
  };
  Assets.init({
    address: DataTypes.STRING,
    preferences: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Assets',
    tableName: 'assets',
  });
  return Assets;
};
