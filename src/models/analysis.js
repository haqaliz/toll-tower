const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Analysis extends Model {
    static async targetCount(targetType, targetId, from, to) {
      return Analysis.findAll({
        attributes: [
          [
            sequelize.fn('date_trunc', 'day', sequelize.col('created_at')),
            'created_at',
          ],
          [
            sequelize.cast(sequelize.fn('count', sequelize.col('id')), 'integer'),
            'count',
          ],
        ],
        where: {
          [Op.and]: {
            target_type: targetType,
            target_id: targetId,
            created_at: { [Op.gte]: from },
            created_at: { [Op.lte]: to },
          },
        },
        group: [sequelize.fn('date_trunc', 'day', sequelize.col('created_at'))],
        raw: true,
      });
    }

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
