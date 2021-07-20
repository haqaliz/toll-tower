const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Analysis extends Model {
    static associate(models) {
    }
  };
  Analysis.init({
    user_id: DataTypes.STRING,
    ip_address: DataTypes.STRING,
    geo: DataTypes.JSONB,
    target_type: DataTypes.STRING,
    target_id: DataTypes.STRING,
    duration: DataTypes.INTEGER,
    targets: DataTypes.JSONB,
    created_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Analysis',
    tableName: 'analysis',
    timestamps: false,
  });
  return Analysis;
};
