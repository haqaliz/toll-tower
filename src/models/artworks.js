const { Model } = require('sequelize');
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Artworks extends Model {
    static search(query) {
      return Artworks.findAll({
        where: {
          [Op.or]: [
            { "raw.creator.username": { [Op.iLike]: `%${query}%` } },
            { "raw.creator.name": { [Op.iLike]: `%${query}%` } },
            { "raw.creator.description": { [Op.iLike]: `%${query}%` } },
            { "raw.name": { [Op.iLike]: `%${query}%` } },
            { "raw.description": { [Op.iLike]: `%${query}%` } },
          ],
        },
        include: ['creator'],
      });
    }
    
    static associate(models) {
      Artworks.belongsTo(models.Users, { foreignKey: 'creator_id', as: 'creator' });
    }
  };
  Artworks.init({
    creator_id: DataTypes.STRING,
    raw: DataTypes.JSONB,
    renewed_at: DataTypes.DATE,
    created_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Artworks',
    tableName: 'artworks',
    timestamps: false,
  });
  return Artworks;
};
