const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Analysis extends Model {
    static targetCount(targetType, targetId, from, to) {
      return Analysis.findAll({
        attributes: [
          [
            sequelize.fn('date_trunc', 'day', sequelize.col('created_at')),
            'created_at',
          ],
          [
            sequelize.cast(sequelize.fn('count', sequelize.col('*')), 'integer'),
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

    static async mostViewed(type, offset = 0, limit = 50) {
      const typeOptions = {
        artworks: {
          attributes: [
            'target_id',
            [
              sequelize.cast(sequelize.fn('count', sequelize.col('*')), 'integer'),
              'count',
            ],
          ],
          include: [{
            association: 'artwork',
            include: ['creator'],
          }],
          group: ['target_id', 'artwork.id', 'artwork.creator.id'],
        },
      }[type];
      const items = await Analysis.findAll({
        ...typeOptions,
        where: {
          target_type: type,
        },
        order: [
          ['count', 'DESC'],
        ],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
      return items.map((i) => ({
        ...(type === 'artworks' && {
          ...i.artwork.dataValues,
        }),
        count: i.dataValues.count,
      }));
    }

    static associate(models) {
      Analysis.belongsTo(models.Users, { foreignKey: 'target_id', as: 'user' });
      Analysis.belongsTo(models.Artworks, { foreignKey: 'target_id', as: 'artwork' });
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
